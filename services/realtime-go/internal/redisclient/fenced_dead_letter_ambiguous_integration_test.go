package redisclient

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestFencedDeadLetterCommittedButReplyWasLost(
	t *testing.T,
) {
	client, rawClient :=
		ambiguousCommitRedisClients(
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
			"ambiguous-dead-letter-%d",
			time.Now().UnixNano(),
		)

	leaseKey :=
		"lumos:meeting:{" +
			meetingID +
			"}:runtime-lease"

	fenceKey :=
		"lumos:meeting:{" +
			meetingID +
			"}:runtime-fence"

	sourceStream :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	deadLetterStream :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence-dlq"

	const (
		group = "meeting-actor"

		consumer = "ambiguous-dlq-consumer"

		token = "owner-a-token"
	)

	cleanupAmbiguousCommitKeys(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		sourceStream,
		deadLetterStream,
	)

	// ---------------------------------------------------------
	// Current lease.
	// ---------------------------------------------------------

	if err :=
		rawClient.Set(
			ctx,
			leaseKey,
			token,
			30*time.Second,
		).Err(); err != nil {

		t.Fatalf(
			"seed lease: %v",
			err,
		)
	}

	if err :=
		rawClient.Set(
			ctx,
			fenceKey,
			"1",
			0,
		).Err(); err != nil {

		t.Fatalf(
			"seed fence: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// Source evidence + PEL.
	// ---------------------------------------------------------

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			sourceStream,
			group,
			"0",
		); err != nil {

		t.Fatalf(
			"create source group: %v",
			err,
		)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			sourceStream,
			map[string]any{
				"event_type": "evidence.turn.final",

				"schema_version": "1",

				"event_id": "poison-evidence-1",

				"payload": `{"eventId":"poison-evidence-1"}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"seed source evidence: %v",
			err,
		)
	}

	streams, err :=
		client.XReadGroup(
			ctx,
			group,
			consumer,
			sourceStream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"deliver source evidence: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected exactly one pending evidence message, got %#v",
			streams,
		)
	}

	if streams[0].
		Messages[0].
		ID != messageID {

		t.Fatalf(
			"expected pending message %q, got %q",
			messageID,
			streams[0].
				Messages[0].
				ID,
		)
	}

	// ---------------------------------------------------------
	// Fault injection.
	//
	// All setup commands are complete.
	// Therefore the first EVAL after this point is the fenced
	// DLQ XADD + source XACK Lua script.
	// ---------------------------------------------------------

	client.client.AddHook(
		&atomicCommitReplyLossHook{},
	)

	dlqID, err :=
		client.FencedDeadLetterAndAck(
			ctx,

			leaseKey,
			fenceKey,

			token,
			1,

			sourceStream,
			group,
			messageID,

			deadLetterStream,

			FencedDeadLetterEntry{
				EventType: "evidence.dead_letter.v1",

				SourceEventType: "evidence.turn.final",

				SourceSchemaVersion: "1",

				SourceEventID: "poison-evidence-1",

				SourcePayload: `{"eventId":"poison-evidence-1"}`,

				DeliveryCount: 5,

				Failure: "permanent semantic extraction failure",

				DeadLetteredAt: time.Now().
					UTC().
					Format(
						time.RFC3339Nano,
					),
			},
		)

	// ---------------------------------------------------------
	// Client outcome MUST be unknown.
	// ---------------------------------------------------------

	if dlqID != "" {
		t.Fatalf(
			"unknown DLQ outcome must not return stream ID, got %q",
			dlqID,
		)
	}

	if !errors.Is(
		err,
		ErrAtomicCommitOutcomeUnknown,
	) {
		t.Fatalf(
			"expected ErrAtomicCommitOutcomeUnknown, got %v",
			err,
		)
	}

	if !errors.Is(
		err,
		errInjectedAtomicCommitReplyLoss,
	) {
		t.Fatalf(
			"expected injected reply-loss error to remain discoverable, got %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// Redis itself DID commit.
	// ---------------------------------------------------------

	dlqCount, err :=
		rawClient.XLen(
			ctx,
			deadLetterStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read DLQ length: %v",
			err,
		)
	}

	if dlqCount != 1 {
		t.Fatalf(
			"expected one committed DLQ entry, got %d",
			dlqCount,
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
			"read committed DLQ entry: %v",
			err,
		)
	}

	if len(dlqMessages) != 1 {
		t.Fatalf(
			"expected one DLQ message, got %d",
			len(dlqMessages),
		)
	}

	if dlqMessages[0].
		Values["source_stream_id"] !=
		messageID {

		t.Fatalf(
			"expected DLQ source stream ID %q, got %#v",
			messageID,
			dlqMessages[0].
				Values["source_stream_id"],
		)
	}

	if dlqMessages[0].
		Values["delivery_count"] !=
		"5" {

		t.Fatalf(
			"expected delivery count 5, got %#v",
			dlqMessages[0].
				Values["delivery_count"],
		)
	}

	// ---------------------------------------------------------
	// Source must also already be ACKed.
	// ---------------------------------------------------------

	pending, err :=
		rawClient.XPending(
			ctx,
			sourceStream,
			group,
		).Result()

	if err != nil {
		t.Fatalf(
			"read source pending state: %v",
			err,
		)
	}

	if pending.Count != 0 {
		t.Fatalf(
			"expected source evidence to already be ACKed, pending=%d",
			pending.Count,
		)
	}
}
