package meetingactor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

type poisonMessageExtractor struct{}

func (
	poisonMessageExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) (
	[]semantics.Candidate,
	error,
) {
	return nil,
		errors.New(
			"permanent semantic extraction failure",
		)
}

func TestPoisonEvidenceMovesToDLQAfterRetryBudget(
	t *testing.T,
) {
	client, rawClient :=
		atomicCommitRedisClients(
			t,
		)

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"poison-evidence-%d",
			time.Now().UnixNano(),
		)

	evidenceStream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	semanticStream :=
		redisstream.SemanticStreamKey(
			meetingID,
		)

	deadLetterStream :=
		redisstream.EvidenceDeadLetterStreamKey(
			meetingID,
		)

	checkpointKey :=
		ContextCheckpointKey(
			meetingID,
		)

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "owner-a",
			Token:     "owner-a-token",
			Fence:     1,
		}

	leaseKey :=
		meetinglease.LeaseKey(
			meetingID,
		)

	fenceKey :=
		meetinglease.FenceKey(
			meetingID,
		)

	cleanupActorAtomicKeys(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		evidenceStream,
		semanticStream,
		deadLetterStream,
		checkpointKey,
	)

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "poison-evidence-1",

			MeetingID: meetingID,

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "Alex will prepare the deployment.",

			CapturedAt: time.Now().UTC(),
		}

	message :=
		seedActorAtomicPendingEvidence(
			t,
			client,
			ctx,
			evidenceStream,
			turn,
		)

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	actor :=
		New(
			meetingID,
			poisonMessageExtractor{},
			logger,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"poison-consumer",
			logger,
		)

	currentMessage :=
		message

	for attempt :=
		int64(1); attempt <=
		maxEvidenceDeliveryCount; attempt++ {

		if attempt > 1 {
			claimed, _, err :=
				client.XAutoClaim(
					ctx,
					evidenceStream,
					consumerGroup,
					consumer.consumerName,
					0,
					"0-0",
					1,
				)

			if err != nil {
				t.Fatalf(
					"claim attempt %d: %v",
					attempt,
					err,
				)
			}

			if len(claimed) != 1 {
				t.Fatalf(
					"expected one claimed message on attempt %d, got %d",
					attempt,
					len(claimed),
				)
			}

			currentMessage =
				claimed[0]
		}

		processErr :=
			consumer.process(
				ctx,
				evidenceStream,
				currentMessage,
			)

		if processErr == nil {
			t.Fatalf(
				"expected poison processing failure on attempt %d",
				attempt,
			)
		}

		if isFatalProcessError(
			processErr,
		) {
			t.Fatalf(
				"poison semantic failure unexpectedly fatal on attempt %d: %v",
				attempt,
				processErr,
			)
		}

		deadLettered, fatalErr :=
			consumer.resolveProcessFailure(
				ctx,
				evidenceStream,
				currentMessage,
				processErr,
			)

		if fatalErr != nil {
			t.Fatalf(
				"resolve failure attempt %d: %v",
				attempt,
				fatalErr,
			)
		}

		if attempt <
			maxEvidenceDeliveryCount {

			if deadLettered {
				t.Fatalf(
					"evidence dead-lettered too early on attempt %d",
					attempt,
				)
			}

			pending, exists, err :=
				client.XPendingEntry(
					ctx,
					evidenceStream,
					consumerGroup,
					message.ID,
				)

			if err != nil {
				t.Fatalf(
					"read pending attempt %d: %v",
					attempt,
					err,
				)
			}

			if !exists {
				t.Fatalf(
					"evidence disappeared before retry budget on attempt %d",
					attempt,
				)
			}

			if pending.DeliveryCount !=
				attempt {

				t.Fatalf(
					"expected delivery count %d, got %d",
					attempt,
					pending.DeliveryCount,
				)
			}

			continue
		}

		if !deadLettered {
			t.Fatalf(
				"expected evidence to enter DLQ on attempt %d",
				attempt,
			)
		}
	}

	pending, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read final pending state: %v",
			err,
		)
	}

	if pending.Count != 0 {
		t.Fatalf(
			"expected poison evidence to be ACKed after DLQ, pending=%d",
			pending.Count,
		)
	}

	dlqMessages, err :=
		rawClient.XRange(
			ctx,
			deadLetterStream,
			"-",
			"+",
		).Result()

	if err != nil {
		t.Fatalf(
			"read DLQ: %v",
			err,
		)
	}

	if len(dlqMessages) != 1 {
		t.Fatalf(
			"expected exactly one DLQ message, got %d",
			len(dlqMessages),
		)
	}

	if dlqMessages[0].
		Values["source_stream_id"] !=
		message.ID {

		t.Fatalf(
			"unexpected DLQ source stream ID: %#v",
			dlqMessages[0].
				Values["source_stream_id"],
		)
	}

	if dlqMessages[0].
		Values["delivery_count"] !=
		fmt.Sprint(
			maxEvidenceDeliveryCount,
		) {

		t.Fatalf(
			"expected DLQ delivery count %d, got %#v",
			maxEvidenceDeliveryCount,
			dlqMessages[0].
				Values["delivery_count"],
		)
	}

	semanticCount, err :=
		rawClient.XLen(
			ctx,
			semanticStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream: %v",
			err,
		)
	}

	if semanticCount != 0 {
		t.Fatalf(
			"poison evidence unexpectedly produced %d semantic events",
			semanticCount,
		)
	}

	_, exists, err :=
		NewContextStore(
			client,
		).Load(
			ctx,
			meetingID,
		)

	if err != nil {
		t.Fatalf(
			"load checkpoint after DLQ: %v",
			err,
		)
	}

	if exists {
		t.Fatal(
			"poison evidence must not advance actor checkpoint",
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"poison evidence must not advance actor memory",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"poison evidence unexpectedly advanced actor observations: %d",
			len(actor.previousObservations),
		)
	}
}
