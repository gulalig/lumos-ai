package meetingactor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisstream"
)

func TestMalformedEvidenceMovesToDLQAfterRetryBudget(
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
			"malformed-poison-%d",
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

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			evidenceStream,
			consumerGroup,
			"0",
		); err != nil {

		t.Fatalf(
			"create evidence group: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// Intentionally malformed:
	//
	// - no event_type
	// - no schema_version
	// - no event_id
	//
	// Only payload exists.
	// ---------------------------------------------------------

	messageID, err :=
		client.XAdd(
			ctx,
			evidenceStream,
			map[string]any{
				"payload": `{"broken":true}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"add malformed evidence: %v",
			err,
		)
	}

	streams, err :=
		client.XReadGroup(
			ctx,
			consumerGroup,
			"malformed-consumer",
			evidenceStream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"deliver malformed evidence: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected one malformed evidence delivery, got %#v",
			streams,
		)
	}

	currentMessage :=
		streams[0].Messages[0]

	if currentMessage.ID !=
		messageID {

		t.Fatalf(
			"expected message %q, got %q",
			messageID,
			currentMessage.ID,
		)
	}

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
			"malformed-consumer",
			logger,
		)

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
				"expected malformed evidence failure on attempt %d",
				attempt,
			)
		}

		if isFatalProcessError(
			processErr,
		) {
			t.Fatalf(
				"malformed evidence should be retryable before DLQ: %v",
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
				"resolve malformed failure on attempt %d: %v",
				attempt,
				fatalErr,
			)
		}

		if attempt <
			maxEvidenceDeliveryCount {

			if deadLettered {
				t.Fatalf(
					"malformed evidence dead-lettered too early on attempt %d",
					attempt,
				)
			}

			continue
		}

		if !deadLettered {
			t.Fatalf(
				"expected malformed evidence to enter DLQ on attempt %d",
				attempt,
			)
		}
	}

	// ---------------------------------------------------------
	// Source must be ACKed.
	// ---------------------------------------------------------

	pending, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read pending state: %v",
			err,
		)
	}

	if pending.Count != 0 {
		t.Fatalf(
			"expected malformed evidence to leave PEL, pending=%d",
			pending.Count,
		)
	}

	// ---------------------------------------------------------
	// Exactly one DLQ entry.
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
			"read DLQ: %v",
			err,
		)
	}

	if len(dlqMessages) != 1 {
		t.Fatalf(
			"expected one malformed DLQ entry, got %d",
			len(dlqMessages),
		)
	}

	dlq :=
		dlqMessages[0]

	if dlq.Values["source_stream_id"] !=
		messageID {

		t.Fatalf(
			"expected source stream ID %q, got %#v",
			messageID,
			dlq.Values["source_stream_id"],
		)
	}

	// Missing metadata must use safe fallbacks instead of
	// preventing the poison message from being quarantined.
	if dlq.Values["source_event_type"] !=
		"unknown" {

		t.Fatalf(
			"expected source_event_type fallback, got %#v",
			dlq.Values["source_event_type"],
		)
	}

	if dlq.Values["source_event_id"] !=
		"unknown" {

		t.Fatalf(
			"expected source_event_id fallback, got %#v",
			dlq.Values["source_event_id"],
		)
	}

	if dlq.Values["source_schema_version"] !=
		"unknown" {

		t.Fatalf(
			"expected source_schema_version fallback, got %#v",
			dlq.Values["source_schema_version"],
		)
	}

	if dlq.Values["source_payload"] !=
		`{"broken":true}` {

		t.Fatalf(
			"unexpected source payload: %#v",
			dlq.Values["source_payload"],
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

	// ---------------------------------------------------------
	// Bad evidence must never create semantics/checkpoint/state.
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
			"malformed evidence produced %d semantic events",
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
			"malformed evidence unexpectedly advanced checkpoint",
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"malformed evidence unexpectedly advanced actor memory",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"malformed evidence unexpectedly advanced observations: %d",
			len(actor.previousObservations),
		)
	}
}
