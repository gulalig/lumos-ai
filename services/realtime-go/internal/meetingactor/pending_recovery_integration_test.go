package meetingactor

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

type pendingRecoveryTestExtractor struct{}

func (
	pendingRecoveryTestExtractor,
) Extract(
	ctx context.Context,
	turn evidence.Turn,
) ([]semantics.Candidate, error) {
	return []semantics.Candidate{
		{
			Kind: semantics.KindUnknown,

			Summary: "No actionable outcome.",

			Explicit: false,

			Confidence: 1,
		},
	}, nil
}

type pendingRecoveryTestPublisher struct{}

func (
	pendingRecoveryTestPublisher,
) Publish(
	ctx context.Context,
	meetingID string,
	observation semantics.Observation,
) (string, error) {
	// This test is about evidence PEL recovery,
	// checkpointing and ACK behavior.
	//
	// We intentionally avoid creating a real semantic
	// stream entry here.
	return "0-0", nil
}

func TestRecoverPendingClaimsYoungMessageImmediately(
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
			"REDIS_URL is not set; skipping Redis integration test",
		)
	}

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)

	defer cancel()

	client, err :=
		redisclient.New(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"create redis client: %v",
			err,
		)
	}

	defer func() {
		_ = client.Close()
	}()

	if err := client.Ping(
		ctx,
	); err != nil {
		t.Fatalf(
			"ping redis: %v",
			err,
		)
	}

	rawOptions, err :=
		redis.ParseURL(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"parse redis URL for cleanup: %v",
			err,
		)
	}

	rawClient :=
		redis.NewClient(
			rawOptions,
		)

	defer func() {
		_ = rawClient.Close()
	}()

	meetingID :=
		"pending-recovery-" +
			uuid.NewString()

	stream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	checkpointKey :=
		ContextCheckpointKey(
			meetingID,
		)

	defer func() {
		cleanupCtx, cleanupCancel :=
			context.WithTimeout(
				context.Background(),
				3*time.Second,
			)

		defer cleanupCancel()

		_ = rawClient.Del(
			cleanupCtx,
			stream,
			checkpointKey,
			meetinglease.LeaseKey(
				meetingID,
			),
			meetinglease.FenceKey(
				meetingID,
			),
		).Err()
	}()

	if err := client.XGroupCreateMkStream(
		ctx,
		stream,
		consumerGroup,
		"0",
	); err != nil {
		t.Fatalf(
			"create evidence consumer group: %v",
			err,
		)
	}

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "event-" +
				uuid.NewString(),

			MeetingID: meetingID,

			ParticipantID: "participant-1",

			TrackID: "track-1",

			TurnOrder: 0,

			Text: "Nothing actionable.",

			CapturedAt: time.Now().
				UTC(),
		}

	payload, err :=
		json.Marshal(
			turn,
		)

	if err != nil {
		t.Fatalf(
			"marshal evidence turn: %v",
			err,
		)
	}

	messageID, err :=
		client.XAdd(
			ctx,
			stream,
			map[string]any{
				"event_type": evidence.EventType,

				"payload": string(
					payload,
				),
			},
		)

	if err != nil {
		t.Fatalf(
			"publish test evidence: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// OWNER A
	//
	// Deliver the message into the consumer group's PEL,
	// but deliberately do NOT ACK it.
	//
	// This simulates:
	//
	// XREADGROUP
	//     ↓
	// message becomes pending
	//     ↓
	// owner A crashes before processing/ACK
	// ---------------------------------------------------------

	streams, err :=
		client.XReadGroup(
			ctx,
			consumerGroup,
			"owner-a",
			stream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"owner A read evidence: %v",
			err,
		)
	}

	if len(streams) != 1 {
		t.Fatalf(
			"expected one Redis stream result, got %d",
			len(streams),
		)
	}

	if len(
		streams[0].Messages,
	) != 1 {
		t.Fatalf(
			"expected one delivered evidence message, got %d",
			len(
				streams[0].
					Messages,
			),
		)
	}

	delivered :=
		streams[0].
			Messages[0]

	if delivered.ID !=
		messageID {

		t.Fatalf(
			"expected delivered message %q, got %q",
			messageID,
			delivered.ID,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatalf(
			"read pending progress before takeover: %v",
			err,
		)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"expected one pending message before takeover, got %d",
			progress.Pending,
		)
	}

	// ---------------------------------------------------------
	// PROVE MESSAGE IS STILL TOO YOUNG FOR NORMAL RETRY
	//
	// A normal runtime retry uses 5 seconds.
	//
	// Immediately after owner A received the message it must
	// NOT yet qualify for that retry policy.
	// ---------------------------------------------------------

	normalRetryMessages, _, err :=
		client.XAutoClaim(
			ctx,
			stream,
			consumerGroup,
			"normal-retry-probe",
			pendingRetryMinIdle,
			"0-0",
			readBatchSize,
		)

	if err != nil {
		t.Fatalf(
			"probe normal retry window: %v",
			err,
		)
	}

	if len(
		normalRetryMessages,
	) != 0 {
		t.Fatalf(
			"young pending evidence unexpectedly qualified for %s retry window",
			pendingRetryMinIdle,
		)
	}

	// ---------------------------------------------------------
	// OWNER B
	//
	// New distributed owner takes over.
	//
	// Startup recovery uses minIdle=0, therefore the young
	// pending evidence must be reclaimable immediately.
	// ---------------------------------------------------------

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
			pendingRecoveryTestExtractor{},
			logger,
		)

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "owner-b",

			Token: "pending-recovery-owner-b",

			Fence: 1,
		}

	if err :=
		rawClient.Set(
			ctx,

			meetinglease.LeaseKey(
				meetingID,
			),

			lease.Token,

			30*time.Second,
		).Err(); err != nil {

		t.Fatalf(
			"seed active meeting lease: %v",
			err,
		)
	}

	if err :=
		rawClient.Set(
			ctx,

			meetinglease.FenceKey(
				meetingID,
			),

			"1",

			0,
		).Err(); err != nil {

		t.Fatalf(
			"seed meeting fence: %v",
			err,
		)
	}

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"owner-b",
			logger,
		)

	recoveryStarted :=
		time.Now()

	if err := consumer.recoverPending(
		ctx,
		stream,
		0,
	); err != nil {
		t.Fatalf(
			"owner B immediate pending recovery: %v",
			err,
		)
	}

	recoveryDuration :=
		time.Since(
			recoveryStarted,
		)

	// We do not require millisecond-level timing.
	//
	// The important invariant is that recovery did not wait
	// for the normal five-second retry window.
	if recoveryDuration >=
		pendingRetryMinIdle {

		t.Fatalf(
			"ownership takeover waited for normal retry window: recovery=%s retryWindow=%s",
			recoveryDuration,
			pendingRetryMinIdle,
		)
	}

	progress, err =
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatalf(
			"read pending progress after takeover: %v",
			err,
		)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected no pending evidence after takeover recovery, got %d",
			progress.Pending,
		)
	}

	// ---------------------------------------------------------
	// CHECKPOINT + ACK
	//
	// Successful recovery must not only remove the entry from
	// the PEL. It must also persist the actor checkpoint for
	// exactly that evidence stream entry.
	// ---------------------------------------------------------

	contextStore :=
		NewContextStore(
			client,
		)

	checkpoint, exists, err :=
		contextStore.Load(
			ctx,
			meetingID,
		)

	if err != nil {
		t.Fatalf(
			"load recovered actor checkpoint: %v",
			err,
		)
	}

	if !exists {
		t.Fatal(
			"expected actor checkpoint after recovered evidence was processed",
		)
	}

	if checkpoint.EvidenceStreamID !=
		messageID {

		t.Fatalf(
			"expected checkpoint evidence stream ID %q, got %q",
			messageID,
			checkpoint.EvidenceStreamID,
		)
	}

	if checkpoint.Turn.EventID !=
		turn.EventID {

		t.Fatalf(
			"expected checkpoint event ID %q, got %q",
			turn.EventID,
			checkpoint.Turn.EventID,
		)
	}

	if checkpoint.MeetingID !=
		meetingID {

		t.Fatalf(
			"expected checkpoint meeting ID %q, got %q",
			meetingID,
			checkpoint.MeetingID,
		)
	}
}
