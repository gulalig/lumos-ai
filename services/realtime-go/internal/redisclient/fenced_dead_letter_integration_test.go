package redisclient

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestFencedDeadLetterAndAckMovesPendingEvidence(
	t *testing.T,
) {
	client, rawClient :=
		deadLetterTestClients(
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
			"dead-letter-%d",
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

		consumer = "consumer-a"

		token = "owner-a-token"
	)

	deadLetterCleanup(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		sourceStream,
		deadLetterStream,
	)

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

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			sourceStream,
			group,
			"0",
		); err != nil {

		t.Fatalf(
			"create group: %v",
			err,
		)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			sourceStream,
			map[string]any{
				"event_type": "evidence.turn.final",

				"schema_version": 1,

				"event_id": "evidence-1",

				"payload": `{"eventId":"evidence-1"}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"seed evidence: %v",
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
			"deliver evidence: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected one pending evidence message, got %#v",
			streams,
		)
	}

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

				SourceEventID: "evidence-1",

				SourcePayload: `{"eventId":"evidence-1"}`,

				DeliveryCount: 5,

				Failure: "semantic extraction failed",

				DeadLetteredAt: time.Now().
					UTC().
					Format(
						time.RFC3339Nano,
					),
			},
		)

	if err != nil {
		t.Fatalf(
			"dead-letter evidence: %v",
			err,
		)
	}

	if strings.TrimSpace(
		dlqID,
	) == "" {
		t.Fatal(
			"expected DLQ stream ID",
		)
	}

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
			"expected source evidence to be ACKed, pending=%d",
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
			"read dead-letter stream: %v",
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
}

func TestFencedDeadLetterRejectsStaleOwnerWithoutMutation(
	t *testing.T,
) {
	client, rawClient :=
		deadLetterTestClients(
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
			"dead-letter-stale-%d",
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

		consumer = "consumer-a"
	)

	deadLetterCleanup(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		sourceStream,
		deadLetterStream,
	)

	// Current owner is B / fence 2.
	if err :=
		rawClient.Set(
			ctx,
			leaseKey,
			"owner-b-token",
			30*time.Second,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		rawClient.Set(
			ctx,
			fenceKey,
			"2",
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			sourceStream,
			group,
			"0",
		); err != nil {

		t.Fatal(err)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			sourceStream,
			map[string]any{
				"event_type": "evidence.turn.final",

				"event_id": "evidence-1",

				"payload": `{"eventId":"evidence-1"}`,
			},
		)

	if err != nil {
		t.Fatal(err)
	}

	if _, err :=
		client.XReadGroup(
			ctx,
			group,
			consumer,
			sourceStream,
			1,
			100*time.Millisecond,
		); err != nil {

		t.Fatal(err)
	}

	_, err =
		client.FencedDeadLetterAndAck(
			ctx,

			leaseKey,
			fenceKey,

			// Stale owner A.
			"owner-a-token",
			1,

			sourceStream,
			group,
			messageID,

			deadLetterStream,

			FencedDeadLetterEntry{
				EventType: "evidence.dead_letter.v1",

				SourceEventType: "evidence.turn.final",

				SourceEventID: "evidence-1",

				SourcePayload: `{"eventId":"evidence-1"}`,

				DeliveryCount: 5,

				Failure: "semantic extraction failed",

				DeadLetteredAt: time.Now().
					UTC().
					Format(
						time.RFC3339Nano,
					),
			},
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected stale-owner rejection, got %v",
			err,
		)
	}

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

	if dlqCount != 0 {
		t.Fatalf(
			"stale owner wrote %d DLQ messages",
			dlqCount,
		)
	}

	pending, err :=
		rawClient.XPending(
			ctx,
			sourceStream,
			group,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if pending.Count != 1 {
		t.Fatalf(
			"stale owner unexpectedly ACKed source evidence, pending=%d",
			pending.Count,
		)
	}
}

func deadLetterTestClients(
	t *testing.T,
) (
	*Client,
	*redis.Client,
) {
	t.Helper()

	redisURL :=
		strings.TrimSpace(
			os.Getenv(
				"REDIS_URL",
			),
		)

	if redisURL == "" {
		t.Skip(
			"REDIS_URL is not configured",
		)
	}

	client, err :=
		New(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"create redis client: %v",
			err,
		)
	}

	t.Cleanup(
		func() {
			_ = client.Close()
		},
	)

	options, err :=
		redis.ParseURL(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"parse redis URL: %v",
			err,
		)
	}

	rawClient :=
		redis.NewClient(
			options,
		)

	t.Cleanup(
		func() {
			_ = rawClient.Close()
		},
	)

	if err :=
		rawClient.Ping(
			context.Background(),
		).Err(); err != nil {

		t.Fatalf(
			"ping redis: %v",
			err,
		)
	}

	return client,
		rawClient
}

func deadLetterCleanup(
	t *testing.T,
	rawClient *redis.Client,
	keys ...string,
) {
	t.Helper()

	t.Cleanup(
		func() {
			ctx, cancel :=
				context.WithTimeout(
					context.Background(),
					3*time.Second,
				)

			defer cancel()

			_ =
				rawClient.Del(
					ctx,
					keys...,
				).Err()
		},
	)
}
