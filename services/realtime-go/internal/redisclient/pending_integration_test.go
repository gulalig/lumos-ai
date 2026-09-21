package redisclient

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestXPendingEntryTracksDeliveryCount(
	t *testing.T,
) {
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

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

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

	defer client.Close()

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

	defer rawClient.Close()

	if err :=
		rawClient.Ping(
			ctx,
		).Err(); err != nil {

		t.Fatalf(
			"ping redis: %v",
			err,
		)
	}

	stream :=
		fmt.Sprintf(
			"lumos:test:{pending-%d}:stream",
			time.Now().UnixNano(),
		)

	const (
		group = "pending-entry-test"

		consumerA = "consumer-a"

		consumerB = "consumer-b"
	)

	defer func() {
		cleanupCtx, cleanupCancel :=
			context.WithTimeout(
				context.Background(),
				3*time.Second,
			)

		defer cleanupCancel()

		_ =
			rawClient.Del(
				cleanupCtx,
				stream,
			).Err()
	}()

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			stream,
			group,
			"0",
		); err != nil {

		t.Fatalf(
			"create consumer group: %v",
			err,
		)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			stream,
			map[string]any{
				"event_type": "test.event",

				"payload": `{"value":"test"}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"add stream message: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// First delivery.
	// ---------------------------------------------------------

	streams, err :=
		client.XReadGroup(
			ctx,
			group,
			consumerA,
			stream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"first group delivery: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected one first delivery, got %#v",
			streams,
		)
	}

	pending, exists, err :=
		client.XPendingEntry(
			ctx,
			stream,
			group,
			messageID,
		)

	if err != nil {
		t.Fatalf(
			"read first pending metadata: %v",
			err,
		)
	}

	if !exists {
		t.Fatal(
			"expected message to be pending after first delivery",
		)
	}

	if pending.DeliveryCount != 1 {
		t.Fatalf(
			"expected first delivery count 1, got %d",
			pending.DeliveryCount,
		)
	}

	if pending.Consumer !=
		consumerA {

		t.Fatalf(
			"expected consumer %q, got %q",
			consumerA,
			pending.Consumer,
		)
	}

	// ---------------------------------------------------------
	// Claim by another consumer.
	//
	// XAUTOCLAIM increments Redis' delivery counter.
	// ---------------------------------------------------------

	claimed, _, err :=
		client.XAutoClaim(
			ctx,
			stream,
			group,
			consumerB,
			0,
			"0-0",
			1,
		)

	if err != nil {
		t.Fatalf(
			"auto-claim pending message: %v",
			err,
		)
	}

	if len(claimed) != 1 {
		t.Fatalf(
			"expected one claimed message, got %d",
			len(claimed),
		)
	}

	if claimed[0].ID !=
		messageID {

		t.Fatalf(
			"expected claimed message %q, got %q",
			messageID,
			claimed[0].ID,
		)
	}

	pending, exists, err =
		client.XPendingEntry(
			ctx,
			stream,
			group,
			messageID,
		)

	if err != nil {
		t.Fatalf(
			"read claimed pending metadata: %v",
			err,
		)
	}

	if !exists {
		t.Fatal(
			"expected claimed message to remain pending",
		)
	}

	if pending.DeliveryCount != 2 {
		t.Fatalf(
			"expected delivery count 2 after XAUTOCLAIM, got %d",
			pending.DeliveryCount,
		)
	}

	if pending.Consumer !=
		consumerB {

		t.Fatalf(
			"expected claimed consumer %q, got %q",
			consumerB,
			pending.Consumer,
		)
	}

	// ---------------------------------------------------------
	// ACK removes it from PEL.
	// ---------------------------------------------------------

	if err :=
		client.XAck(
			ctx,
			stream,
			group,
			messageID,
		); err != nil {

		t.Fatalf(
			"ack test message: %v",
			err,
		)
	}

	_, exists, err =
		client.XPendingEntry(
			ctx,
			stream,
			group,
			messageID,
		)

	if err != nil {
		t.Fatalf(
			"read pending metadata after ACK: %v",
			err,
		)
	}

	if exists {
		t.Fatal(
			"ACKed message must not remain in the PEL",
		)
	}
}
