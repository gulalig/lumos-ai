package meetingactor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

func TestOversizedRawEvidenceStoresBoundedDLQPayload(
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
			"bounded-dlq-payload-%d",
			time.Now().UnixNano(),
		)

	evidenceStream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	deadLetterStream :=
		redisstream.EvidenceDeadLetterStreamKey(
			meetingID,
		)

	semanticStream :=
		redisstream.SemanticStreamKey(
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
		deadLetterStream,
		semanticStream,
		checkpointKey,
	)

	lease :=
		meetinglease.Lease{
			MeetingID:
				meetingID,

			OwnerID:
				"owner-a",

			Token:
				"owner-a-token",

			Fence:
				1,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	if err :=
		rawClient.XGroupCreateMkStream(
			ctx,
			evidenceStream,
			consumerGroup,
			"0",
		).Err(); err != nil {

		t.Fatalf(
			"create evidence consumer group: %v",
			err,
		)
	}

	// Much larger than both the allowed evidence payload and
	// the allowed forensic DLQ payload.
	rawPayload :=
		strings.Repeat(
			"x",
			redisclient.MaxDeadLetterSourcePayloadBytes*4,
		)

	streamID, err :=
		rawClient.XAdd(
			ctx,
			&redis.XAddArgs{
				Stream:
					evidenceStream,

				Values:
					map[string]any{
						"event_type":
							evidence.EventType,

						"schema_version":
							evidence.SchemaVersion,

						"event_id":
							"oversized-raw-event",

						"payload":
							rawPayload,
					},
			},
		).Result()

	if err != nil {
		t.Fatalf(
			"seed oversized raw evidence: %v",
			err,
		)
	}

	streams, err :=
		rawClient.XReadGroup(
			ctx,
			&redis.XReadGroupArgs{
				Group:
					consumerGroup,

				Consumer:
					"bounded-dlq-consumer",

				Streams:
					[]string{
						evidenceStream,
						">",
					},

				Count:
					1,

				Block:
					time.Second,
			},
		).Result()

	if err != nil {
		t.Fatalf(
			"deliver oversized evidence: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected exactly one delivered evidence message",
		)
	}

	message :=
		streams[0].Messages[0]

	if message.ID !=
		streamID {

		t.Fatalf(
			"expected stream ID %q, got %q",
			streamID,
			message.ID,
		)
	}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	extractor :=
		&countingPayloadExtractor{}

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
			"bounded-dlq-consumer",
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
				"expected oversized payload failure on attempt %d",
				attempt,
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
					"message dead-lettered too early on attempt %d",
					attempt,
				)
			}

			continue
		}

		if !deadLettered {
			t.Fatal(
				"expected oversized payload to be dead-lettered",
			)
		}
	}

	if calls :=
		extractor.calls.Load(); calls != 0 {

		t.Fatalf(
			"oversized raw payload reached extractor %d times",
			calls,
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
			"expected one DLQ entry, got %d",
			len(dlqMessages),
		)
	}

	storedPayload :=
		fmt.Sprint(
			dlqMessages[0].
				Values["source_payload"],
		)

	if len(storedPayload) >
		redisclient.MaxDeadLetterSourcePayloadBytes {

		t.Fatalf(
			"DLQ payload exceeded limit: got %d bytes, max %d",
			len(storedPayload),
			redisclient.MaxDeadLetterSourcePayloadBytes,
		)
	}

	if len(storedPayload) >=
		len(rawPayload) {

		t.Fatal(
			"DLQ unexpectedly stored the complete oversized source payload",
		)
	}

	expectedMarker :=
		fmt.Sprintf(
			"[truncated; original_bytes=%d]",
			len(rawPayload),
		)

	if !strings.Contains(
		storedPayload,
		expectedMarker,
	) {
		t.Fatalf(
			"DLQ payload missing truncation metadata: %q",
			storedPayload[
				len(storedPayload)-128:
			],
		)
	}

	pending, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read final PEL: %v",
			err,
		)
	}

	if pending.Count != 0 {
		t.Fatalf(
			"expected empty PEL after DLQ, got %d",
			pending.Count,
		)
	}
}
