package redisclient

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

var errInjectedAtomicCommitReplyLoss = errors.New(
	"injected atomic commit reply loss",
)

type atomicCommitReplyLossHook struct {
	once sync.Once
}

func (
	h *atomicCommitReplyLossHook,
) DialHook(
	next redis.DialHook,
) redis.DialHook {
	return next
}

func (
	h *atomicCommitReplyLossHook,
) ProcessHook(
	next redis.ProcessHook,
) redis.ProcessHook {
	return func(
		ctx context.Context,
		cmd redis.Cmder,
	) error {
		err :=
			next(
				ctx,
				cmd,
			)

		if err != nil {
			return err
		}

		if !strings.EqualFold(
			cmd.Name(),
			"eval",
		) {
			return nil
		}

		var injected bool

		h.once.Do(
			func() {
				injected = true
			},
		)

		if !injected {
			return nil
		}

		// Redis has already successfully executed the EVAL.
		//
		// We now overwrite the client-visible command error to
		// simulate:
		//
		//     server committed
		//         ↓
		//     reply / connection lost
		//         ↓
		//     caller sees error
		//
		// This is the ambiguity Step 31 protects against.
		cmd.SetErr(
			errInjectedAtomicCommitReplyLoss,
		)

		return errInjectedAtomicCommitReplyLoss
	}
}

func (
	h *atomicCommitReplyLossHook,
) ProcessPipelineHook(
	next redis.ProcessPipelineHook,
) redis.ProcessPipelineHook {
	return next
}

func TestFencedBatchCommitSucceededButReplyWasLost(
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
			"ambiguous-commit-%d",
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

	checkpointKey :=
		"lumos:meeting:{" +
			meetingID +
			"}:actor-context"

	sourceStream :=
		"lumos:meeting:{" +
			meetingID +
			"}:evidence"

	destinationStream :=
		"lumos:meeting:{" +
			meetingID +
			"}:semantics"

	const (
		group = "meeting-actor"

		consumer = "ambiguous-commit-consumer"

		token = "owner-a-token"

		checkpointValue = `{"checkpoint":"committed"}`
	)

	cleanupAmbiguousCommitKeys(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		checkpointKey,
		sourceStream,
		destinationStream,
	)

	// ---------------------------------------------------------
	// Active lease
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
	// Source evidence + consumer group
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

				"event_id": "evidence-1",

				"payload": `{"event":"evidence-1"}`,
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
			"deliver source evidence to PEL: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected exactly one pending source message, got %#v",
			streams,
		)
	}

	if streams[0].
		Messages[0].
		ID != messageID {

		t.Fatalf(
			"expected pending message %q, got %q",
			messageID,
			streams[0].Messages[0].ID,
		)
	}

	// ---------------------------------------------------------
	// Fault injection
	// ---------------------------------------------------------
	//
	// IMPORTANT:
	// Add the hook only AFTER all setup commands.
	//
	// Therefore the first EVAL seen by this hook is exactly the
	// atomic fenced commit we want to test.

	client.client.AddHook(
		&atomicCommitReplyLossHook{},
	)

	entries :=
		[]FencedStreamEntry{
			{
				EventType: "semantic.observation.v1",

				EventID: "semantic-1",

				Payload: `{"id":"semantic-1"}`,
			},
		}

	committed, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,
			leaseKey,
			fenceKey,
			token,
			1,
			sourceStream,
			group,
			messageID,
			checkpointKey,
			checkpointValue,
			destinationStream,
			entries,
		)

	// ---------------------------------------------------------
	// Client must see UNKNOWN outcome.
	// ---------------------------------------------------------

	if committed != 0 {
		t.Fatalf(
			"unknown client outcome must not report committed entries, got %d",
			committed,
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
	// BUT Redis must show that the transaction committed.
	// ---------------------------------------------------------

	semanticCount, err :=
		rawClient.XLen(
			ctx,
			destinationStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream length: %v",
			err,
		)
	}

	if semanticCount != 1 {
		t.Fatalf(
			"expected Redis to contain one committed semantic event, got %d",
			semanticCount,
		)
	}

	semanticMessages, err :=
		rawClient.XRange(
			ctx,
			destinationStream,
			"-",
			"+",
		).Result()

	if err != nil {
		t.Fatalf(
			"read committed semantic event: %v",
			err,
		)
	}

	if len(semanticMessages) != 1 {
		t.Fatalf(
			"expected one semantic message, got %d",
			len(semanticMessages),
		)
	}

	eventID, ok :=
		semanticMessages[0].
			Values["event_id"].(string)

	if !ok ||
		eventID != "semantic-1" {

		t.Fatalf(
			"expected semantic event ID semantic-1, got %#v",
			semanticMessages[0].Values,
		)
	}

	// ---------------------------------------------------------
	// Checkpoint must also have committed.
	// ---------------------------------------------------------

	storedCheckpoint, err :=
		rawClient.Get(
			ctx,
			checkpointKey,
		).Result()

	if err != nil {
		t.Fatalf(
			"read committed checkpoint: %v",
			err,
		)
	}

	if storedCheckpoint !=
		checkpointValue {

		t.Fatalf(
			"expected checkpoint %q, got %q",
			checkpointValue,
			storedCheckpoint,
		)
	}

	// ---------------------------------------------------------
	// Source evidence must also have been ACKed.
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
			"expected committed source evidence to be ACKed, pending=%d",
			pending.Count,
		)
	}
}

func ambiguousCommitRedisClients(
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
			"parse Redis URL: %v",
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
			"ping Redis: %v",
			err,
		)
	}

	return client,
		rawClient
}

func cleanupAmbiguousCommitKeys(
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
