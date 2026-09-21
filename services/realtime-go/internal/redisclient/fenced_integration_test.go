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

func TestFencedXAddRejectsStaleLease(
	t *testing.T,
) {
	client, rawClient, redisURL :=
		integrationRedisClients(
			t,
		)

	_ = redisURL

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"fenced-xadd-%d",
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

	stream :=
		"lumos:meeting:{" +
			meetingID +
			"}:fenced-test-stream"

	defer func() {
		cleanupCtx, cleanupCancel :=
			context.WithTimeout(
				context.Background(),
				3*time.Second,
			)

		defer cleanupCancel()

		_ = rawClient.Del(
			cleanupCtx,
			leaseKey,
			fenceKey,
			stream,
		).Err()
	}()

	// ---------------------------------------------------------
	// Owner A acquires generation 1.
	// ---------------------------------------------------------

	if err := rawClient.Set(
		ctx,
		leaseKey,
		"token-a",
		30*time.Second,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner A lease: %v",
			err,
		)
	}

	if err := rawClient.Set(
		ctx,
		fenceKey,
		"1",
		0,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner A fence: %v",
			err,
		)
	}

	firstID, err :=
		client.FencedXAdd(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			stream,
			map[string]any{
				"event_type": "test.event",
				"event_id":   "event-a",
				"payload":    "owner-a",
			},
		)

	if err != nil {
		t.Fatalf(
			"current owner A fenced xadd: %v",
			err,
		)
	}

	if firstID == "" {
		t.Fatal(
			"expected stream ID from current owner A",
		)
	}

	length, err :=
		rawClient.XLen(
			ctx,
			stream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read stream length after owner A write: %v",
			err,
		)
	}

	if length != 1 {
		t.Fatalf(
			"expected stream length 1 after owner A write, got %d",
			length,
		)
	}

	// ---------------------------------------------------------
	// Matching token but wrong fence must fail.
	// ---------------------------------------------------------

	_, err =
		client.FencedXAdd(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			999,
			stream,
			map[string]any{
				"event_type": "test.event",
				"event_id":   "wrong-fence",
				"payload":    "must-not-write",
			},
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected wrong fence rejection, got %v",
			err,
		)
	}

	length, err =
		rawClient.XLen(
			ctx,
			stream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read stream length after wrong fence: %v",
			err,
		)
	}

	if length != 1 {
		t.Fatalf(
			"wrong fence mutated stream: expected length 1, got %d",
			length,
		)
	}

	// ---------------------------------------------------------
	// Lease disappears.
	//
	// Fence counter still says generation 1.
	// Fence-only validation would incorrectly allow A here.
	//
	// Token + active lease validation MUST reject it.
	// ---------------------------------------------------------

	if err := rawClient.Del(
		ctx,
		leaseKey,
	).Err(); err != nil {
		t.Fatalf(
			"expire owner A lease: %v",
			err,
		)
	}

	_, err =
		client.FencedXAdd(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			stream,
			map[string]any{
				"event_type": "test.event",
				"event_id":   "expired-owner",
				"payload":    "must-not-write",
			},
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected expired lease rejection, got %v",
			err,
		)
	}

	length, err =
		rawClient.XLen(
			ctx,
			stream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read stream length after expired lease write: %v",
			err,
		)
	}

	if length != 1 {
		t.Fatalf(
			"expired owner mutated stream: expected length 1, got %d",
			length,
		)
	}

	// ---------------------------------------------------------
	// Owner B takes over generation 2.
	// ---------------------------------------------------------

	if err := rawClient.Set(
		ctx,
		leaseKey,
		"token-b",
		30*time.Second,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner B lease: %v",
			err,
		)
	}

	if err := rawClient.Set(
		ctx,
		fenceKey,
		"2",
		0,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner B fence: %v",
			err,
		)
	}

	// Old owner A wakes up after takeover.
	_, err =
		client.FencedXAdd(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			stream,
			map[string]any{
				"event_type": "test.event",
				"event_id":   "stale-owner-a",
				"payload":    "must-not-write",
			},
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected stale owner A rejection, got %v",
			err,
		)
	}

	length, err =
		rawClient.XLen(
			ctx,
			stream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read stream length after stale owner A: %v",
			err,
		)
	}

	if length != 1 {
		t.Fatalf(
			"stale owner A mutated stream: expected length 1, got %d",
			length,
		)
	}

	// Current owner B must succeed.
	secondID, err :=
		client.FencedXAdd(
			ctx,
			leaseKey,
			fenceKey,
			"token-b",
			2,
			stream,
			map[string]any{
				"event_type": "test.event",
				"event_id":   "event-b",
				"payload":    "owner-b",
			},
		)

	if err != nil {
		t.Fatalf(
			"current owner B fenced xadd: %v",
			err,
		)
	}

	if secondID == "" {
		t.Fatal(
			"expected stream ID from current owner B",
		)
	}

	length, err =
		rawClient.XLen(
			ctx,
			stream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read final stream length: %v",
			err,
		)
	}

	if length != 2 {
		t.Fatalf(
			"expected exactly two accepted writes, got %d",
			length,
		)
	}
}

func TestFencedXAckAndSetRejectsStaleLease(
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
			"fenced-ack-%d",
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

	stream :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	checkpointKey :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	group :=
		"meeting-actor-test"

	defer func() {
		cleanupCtx, cleanupCancel :=
			context.WithTimeout(
				context.Background(),
				3*time.Second,
			)

		defer cleanupCancel()

		_ = rawClient.Del(
			cleanupCtx,
			leaseKey,
			fenceKey,
			stream,
			checkpointKey,
		).Err()
	}()

	// Consumer group must exist before delivery.
	if err :=
		client.XGroupCreateMkStream(
			ctx,
			stream,
			group,
			"0",
		); err != nil {

		t.Fatalf(
			"create test consumer group: %v",
			err,
		)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			stream,
			map[string]any{
				"event_type": "evidence.turn.final",
				"payload":    `{"test":true}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"add test evidence: %v",
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
			"deliver test evidence to PEL: %v",
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

	if streams[0].Messages[0].ID !=
		messageID {

		t.Fatalf(
			"expected delivered message %q, got %q",
			messageID,
			streams[0].Messages[0].ID,
		)
	}

	if err := rawClient.Set(
		ctx,
		checkpointKey,
		"checkpoint-before",
		0,
	).Err(); err != nil {
		t.Fatalf(
			"seed checkpoint: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// A was owner generation 1, but B has already taken over.
	// ---------------------------------------------------------

	if err := rawClient.Set(
		ctx,
		leaseKey,
		"token-b",
		30*time.Second,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner B lease: %v",
			err,
		)
	}

	if err := rawClient.Set(
		ctx,
		fenceKey,
		"2",
		0,
	).Err(); err != nil {
		t.Fatalf(
			"seed owner B fence: %v",
			err,
		)
	}

	err =
		client.FencedXAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-a",
			1,
			stream,
			group,
			messageID,
			checkpointKey,
			"stale-checkpoint",
		)

	if !errors.Is(
		err,
		ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected stale checkpoint/ack rejection, got %v",
			err,
		)
	}

	checkpoint, err :=
		client.Get(
			ctx,
			checkpointKey,
		)

	if err != nil {
		t.Fatalf(
			"read checkpoint after stale write: %v",
			err,
		)
	}

	if checkpoint !=
		"checkpoint-before" {

		t.Fatalf(
			"stale owner changed checkpoint: got %q",
			checkpoint,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			stream,
			group,
		)

	if err != nil {
		t.Fatalf(
			"read consumer group after stale ACK: %v",
			err,
		)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"stale owner ACKed evidence: expected pending=1, got %d",
			progress.Pending,
		)
	}

	// ---------------------------------------------------------
	// Current owner B may commit checkpoint + ACK.
	// ---------------------------------------------------------

	err =
		client.FencedXAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-b",
			2,
			stream,
			group,
			messageID,
			checkpointKey,
			"checkpoint-owner-b",
		)

	if err != nil {
		t.Fatalf(
			"current owner B checkpoint/ack: %v",
			err,
		)
	}

	checkpoint, err =
		client.Get(
			ctx,
			checkpointKey,
		)

	if err != nil {
		t.Fatalf(
			"read checkpoint after owner B commit: %v",
			err,
		)
	}

	if checkpoint !=
		"checkpoint-owner-b" {

		t.Fatalf(
			"expected owner B checkpoint, got %q",
			checkpoint,
		)
	}

	progress, err =
		client.XGroupProgress(
			ctx,
			stream,
			group,
		)

	if err != nil {
		t.Fatalf(
			"read consumer group after owner B ACK: %v",
			err,
		)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected pending=0 after current owner commit, got %d",
			progress.Pending,
		)
	}

	// A second commit of the same stream entry must fail because
	// the message is no longer pending.
	err =
		client.FencedXAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			"token-b",
			2,
			stream,
			group,
			messageID,
			checkpointKey,
			"must-not-overwrite",
		)

	if !errors.Is(
		err,
		ErrFencedXAckNotPending,
	) {
		t.Fatalf(
			"expected already-acked message rejection, got %v",
			err,
		)
	}

	checkpoint, err =
		client.Get(
			ctx,
			checkpointKey,
		)

	if err != nil {
		t.Fatalf(
			"read checkpoint after duplicate commit: %v",
			err,
		)
	}

	if checkpoint !=
		"checkpoint-owner-b" {

		t.Fatalf(
			"duplicate commit overwrote checkpoint: got %q",
			checkpoint,
		)
	}
}

func integrationRedisClients(
	t *testing.T,
) (
	*Client,
	*redis.Client,
	string,
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
			"create redisclient: %v",
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
			"parse raw Redis URL: %v",
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

	pingCtx, cancel :=
		context.WithTimeout(
			context.Background(),
			3*time.Second,
		)
	defer cancel()

	if err :=
		client.Ping(
			pingCtx,
		); err != nil {

		t.Fatalf(
			"ping Redis through redisclient: %v",
			err,
		)
	}

	if err :=
		rawClient.Ping(
			pingCtx,
		).Err(); err != nil {

		t.Fatalf(
			"ping Redis through raw client: %v",
			err,
		)
	}

	return client,
		rawClient,
		redisURL
}
