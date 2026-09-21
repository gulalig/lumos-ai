package meetingactor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisstream"
)

func TestOversizedDurableEvidenceMovesToDLQWithoutExtraction(
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
			"oversized-durable-dlq-%d",
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

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "owner-a",

			Token: "owner-a-token",

			Fence: 1,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	// ---------------------------------------------------------
	// Deliberately bypass evidence.NewTurn().
	//
	// This models an old/external producer writing directly
	// into the durable Redis evidence stream.
	// ---------------------------------------------------------

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "oversized-external-event",

			MeetingID: meetingID,

			ParticipantID: "participant-1",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: strings.Repeat(
				"a",
				evidence.MaxTurnTextBytes+1,
			),

			CapturedAt: time.Now().
				UTC(),
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

	extractor :=
		&countingOversizedExtractor{}

	actor :=
		New(
			meetingID,
			extractor,
			logger,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"oversized-dlq-consumer",
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

			if claimed[0].ID !=
				message.ID {

				t.Fatalf(
					"expected claimed message %q, got %q",
					message.ID,
					claimed[0].ID,
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
				"expected oversized evidence failure on attempt %d",
				attempt,
			)
		}

		if isFatalProcessError(
			processErr,
		) {
			t.Fatalf(
				"oversized evidence validation must remain retryable until DLQ: %v",
				processErr,
			)
		}

		if !strings.Contains(
			processErr.Error(),
			evidence.ErrTurnTextTooLarge.Error(),
		) {
			t.Fatalf(
				"expected oversized evidence error on attempt %d, got %v",
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
				"resolve attempt %d: %v",
				attempt,
				fatalErr,
			)
		}

		if attempt <
			maxEvidenceDeliveryCount {

			if deadLettered {
				t.Fatalf(
					"oversized evidence dead-lettered too early on attempt %d",
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
					"oversized evidence disappeared before retry budget on attempt %d",
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
				"expected oversized evidence to enter DLQ on attempt %d",
				attempt,
			)
		}
	}

	// ---------------------------------------------------------
	// Resource guard MUST prevent every LLM/extractor call.
	// ---------------------------------------------------------

	if calls :=
		extractor.calls.Load(); calls != 0 {

		t.Fatalf(
			"oversized durable evidence reached extractor %d times",
			calls,
		)
	}

	// ---------------------------------------------------------
	// Source evidence must leave the PEL after atomic DLQ+ACK.
	// ---------------------------------------------------------

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
			"expected oversized evidence PEL to be empty, pending=%d",
			pending.Count,
		)
	}

	// ---------------------------------------------------------
	// Exactly one quarantine record.
	// ---------------------------------------------------------

	dlqMessages, err :=
		rawClient.XRange(
			ctx,
			deadLetterStream,
			"-",
			"+",
		).Result()

	if err != nil {
		t.Fatalf(
			"read oversized evidence DLQ: %v",
			err,
		)
	}

	if len(dlqMessages) != 1 {
		t.Fatalf(
			"expected one DLQ entry, got %d",
			len(dlqMessages),
		)
	}

	dlq :=
		dlqMessages[0]

	if dlq.Values["source_stream_id"] !=
		message.ID {

		t.Fatalf(
			"expected source stream ID %q, got %#v",
			message.ID,
			dlq.Values["source_stream_id"],
		)
	}

	if dlq.Values["source_event_id"] !=
		turn.EventID {

		t.Fatalf(
			"expected source event ID %q, got %#v",
			turn.EventID,
			dlq.Values["source_event_id"],
		)
	}

	if dlq.Values["delivery_count"] !=
		fmt.Sprint(
			maxEvidenceDeliveryCount,
		) {

		t.Fatalf(
			"expected delivery count %d, got %#v",
			maxEvidenceDeliveryCount,
			dlq.Values["delivery_count"],
		)
	}

	failure :=
		fmt.Sprint(
			dlq.Values["failure"],
		)

	if !strings.Contains(
		failure,
		evidence.ErrTurnTextTooLarge.Error(),
	) {
		t.Fatalf(
			"expected DLQ failure to contain oversized resource error, got %q",
			failure,
		)
	}

	// ---------------------------------------------------------
	// Rejected evidence must create no trusted state.
	// ---------------------------------------------------------

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
			"oversized evidence produced %d semantic entries",
			semanticCount,
		)
	}

	_, checkpointExists, err :=
		NewContextStore(
			client,
		).Load(
			ctx,
			meetingID,
		)

	if err != nil {
		t.Fatalf(
			"load checkpoint: %v",
			err,
		)
	}

	if checkpointExists {
		t.Fatal(
			"oversized evidence unexpectedly advanced checkpoint",
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"oversized evidence unexpectedly advanced actor turn state",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"oversized evidence unexpectedly advanced observations: %d",
			len(actor.previousObservations),
		)
	}
}
