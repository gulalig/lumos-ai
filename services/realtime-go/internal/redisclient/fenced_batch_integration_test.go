package redisclient

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestFencedBatchCommitsSemanticsCheckpointAndAck(
	t *testing.T,
) {
	client, rawClient, _ :=
		integrationRedisClients(
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
			"fenced-batch-success-%d",
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

	source :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	destination :=
		"lumos:meeting:{" +
			meetingID +
			"}:semantics"

	checkpoint :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	group :=
		"meeting-actor"

	cleanupBatchTest(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		source,
		destination,
		checkpoint,
	)

	messageID :=
		seedPendingBatchMessage(
			t,
			client,
			ctx,
			source,
			group,
		)

	seedBatchLease(
		t,
		rawClient,
		ctx,
		leaseKey,
		fenceKey,
		"token-a",
		"1",
	)

	count, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			source,
			group,
			messageID,
			checkpoint,
			`{"checkpoint":"owner-a"}`,
			destination,
			[]FencedStreamEntry{
				{
					EventType: "semantic.observation.v1",
					EventID:   "observation-1",
					Payload:   `{"id":"observation-1"}`,
				},
				{
					EventType: "semantic.observation.v1",
					EventID:   "observation-2",
					Payload:   `{"id":"observation-2"}`,
				},
			},
		)

	if err != nil {
		t.Fatalf(
			"commit fenced semantic batch: %v",
			err,
		)
	}

	if count != 2 {
		t.Fatalf(
			"expected 2 semantic entries, got %d",
			count,
		)
	}

	length, err :=
		rawClient.XLen(
			ctx,
			destination,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if length != 2 {
		t.Fatalf(
			"expected semantic stream length 2, got %d",
			length,
		)
	}

	value, err :=
		rawClient.Get(
			ctx,
			checkpoint,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if value !=
		`{"checkpoint":"owner-a"}` {

		t.Fatalf(
			"unexpected checkpoint %q",
			value,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			source,
			group,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected evidence ACK, pending=%d",
			progress.Pending,
		)
	}
}

func TestFencedBatchRejectsStaleOwnerWithoutPartialCommit(
	t *testing.T,
) {
	client, rawClient, _ :=
		integrationRedisClients(
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
			"fenced-batch-stale-%d",
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

	source :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	destination :=
		"lumos:meeting:{" +
			meetingID +
			"}:semantics"

	checkpoint :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	group :=
		"meeting-actor"

	cleanupBatchTest(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		source,
		destination,
		checkpoint,
	)

	messageID :=
		seedPendingBatchMessage(
			t,
			client,
			ctx,
			source,
			group,
		)

	// B is the active owner.
	seedBatchLease(
		t,
		rawClient,
		ctx,
		leaseKey,
		fenceKey,
		"token-b",
		"2",
	)

	_, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			source,
			group,
			messageID,
			checkpoint,
			`{"checkpoint":"stale-a"}`,
			destination,
			[]FencedStreamEntry{
				{
					EventType: "semantic.observation.v1",
					EventID:   "stale-observation",
					Payload:   `{"id":"stale-observation"}`,
				},
			},
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected stale writer rejection, got %v",
			err,
		)
	}

	length, err :=
		rawClient.XLen(
			ctx,
			destination,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if length != 0 {
		t.Fatalf(
			"stale writer published semantics: length=%d",
			length,
		)
	}

	exists, err :=
		rawClient.Exists(
			ctx,
			checkpoint,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if exists != 0 {
		t.Fatal(
			"stale writer persisted checkpoint",
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			source,
			group,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"stale writer ACKed evidence: pending=%d",
			progress.Pending,
		)
	}
}

func TestFencedBatchZeroObservationsStillCheckpointsAndAcks(
	t *testing.T,
) {
	client, rawClient, _ :=
		integrationRedisClients(
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
			"fenced-batch-zero-%d",
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

	source :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	destination :=
		"lumos:meeting:{" +
			meetingID +
			"}:semantics"

	checkpoint :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	group :=
		"meeting-actor"

	cleanupBatchTest(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		source,
		destination,
		checkpoint,
	)

	messageID :=
		seedPendingBatchMessage(
			t,
			client,
			ctx,
			source,
			group,
		)

	seedBatchLease(
		t,
		rawClient,
		ctx,
		leaseKey,
		fenceKey,
		"token-a",
		"1",
	)

	count, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			source,
			group,
			messageID,
			checkpoint,
			`{"checkpoint":"no-semantics"}`,
			destination,
			nil,
		)

	if err != nil {
		t.Fatal(err)
	}

	if count != 0 {
		t.Fatalf(
			"expected zero semantic entries, got %d",
			count,
		)
	}

	length, err :=
		rawClient.XLen(
			ctx,
			destination,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if length != 0 {
		t.Fatalf(
			"expected no semantic events, got %d",
			length,
		)
	}

	value, err :=
		rawClient.Get(
			ctx,
			checkpoint,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if value !=
		`{"checkpoint":"no-semantics"}` {

		t.Fatalf(
			"unexpected checkpoint %q",
			value,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			source,
			group,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected evidence ACK, pending=%d",
			progress.Pending,
		)
	}
}

func TestFencedBatchInvalidDestinationTypeDoesNotPartiallyCommit(
	t *testing.T,
) {
	client, rawClient, _ :=
		integrationRedisClients(
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
			"fenced-batch-invalid-%d",
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

	source :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	destination :=
		"lumos:meeting:{" +
			meetingID +
			"}:semantics"

	checkpoint :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	group :=
		"meeting-actor"

	cleanupBatchTest(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		source,
		destination,
		checkpoint,
	)

	messageID :=
		seedPendingBatchMessage(
			t,
			client,
			ctx,
			source,
			group,
		)

	seedBatchLease(
		t,
		rawClient,
		ctx,
		leaseKey,
		fenceKey,
		"token-a",
		"1",
	)

	// Corrupt destination type deliberately.
	if err :=
		rawClient.Set(
			ctx,
			destination,
			"not-a-stream",
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}

	_, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			source,
			group,
			messageID,
			checkpoint,
			`{"checkpoint":"must-not-write"}`,
			destination,
			[]FencedStreamEntry{
				{
					EventType: "semantic.observation.v1",
					EventID:   "observation-1",
					Payload:   `{"id":"observation-1"}`,
				},
			},
		)

	if !errors.Is(
		err,
		ErrFencedBatchInvalidState,
	) {
		t.Fatalf(
			"expected invalid state rejection, got %v",
			err,
		)
	}

	exists, err :=
		rawClient.Exists(
			ctx,
			checkpoint,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if exists != 0 {
		t.Fatal(
			"invalid batch state persisted checkpoint",
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			source,
			group,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"invalid batch state ACKed evidence: pending=%d",
			progress.Pending,
		)
	}

	value, err :=
		rawClient.Get(
			ctx,
			destination,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if value != "not-a-stream" {
		t.Fatalf(
			"destination key was modified: %q",
			value,
		)
	}
}

func seedPendingBatchMessage(
	t *testing.T,
	client *Client,
	ctx context.Context,
	stream string,
	group string,
) string {
	t.Helper()

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
				"event_type": "evidence.turn.final",
				"event_id":   "evidence-1",
				"payload":    `{"test":true}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"add evidence message: %v",
			err,
		)
	}

	streams, err :=
		client.XReadGroup(
			ctx,
			group,
			"consumer-a",
			stream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"deliver evidence message: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected one delivered message, got %#v",
			streams,
		)
	}

	return messageID
}

func seedBatchLease(
	t *testing.T,
	rawClient *redis.Client,
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence string,
) {
	t.Helper()

	if err :=
		rawClient.Set(
			ctx,
			leaseKey,
			token,
			30*time.Second,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		rawClient.Set(
			ctx,
			fenceKey,
			fence,
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}
}

func cleanupBatchTest(
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

			_ = rawClient.Del(
				ctx,
				keys...,
			).Err()
		},
	)
}
