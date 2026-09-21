package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

type atomicCommitTestExtractor struct{}

func (atomicCommitTestExtractor) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]semantics.Candidate, error) {
	return []semantics.Candidate{
		{
			Kind: semantics.KindCommitment,

			Summary: "Alex will prepare the deployment",

			Owner: "Alex",

			DueText: "Thursday",

			Explicit: true,

			Confidence: 0.95,
		},
	}, nil
}

// Consumer.process owns the durable semantic commit path.
//
// Actor only prepares validated observations.
// Redis publication happens together with checkpoint + ACK.
type atomicCommitRejectLegacyPublisher struct{}

func (atomicCommitRejectLegacyPublisher) Publish(
	_ context.Context,
	_ string,
	_ semantics.Observation,
) (string, error) {
	return "",
		errors.New(
			"legacy semantic publisher must not be called by Consumer.process",
		)
}

func TestConsumerProcessAtomicallyCommitsSemanticCheckpointAndAck(
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
			"actor-atomic-success-%d",
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

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "evidence-event-1",

			MeetingID: meetingID,

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "Alex will prepare the deployment by Thursday.",

			CapturedAt: time.Now().UTC(),
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

	actor :=
		New(
			meetingID,
			atomicCommitTestExtractor{},
			logger,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"owner-a-consumer",
			logger,
		)

	if err :=
		consumer.process(
			ctx,
			evidenceStream,
			message,
		); err != nil {

		t.Fatalf(
			"process evidence through atomic commit path: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// Semantic stream
	// ---------------------------------------------------------

	semanticMessages, err :=
		rawClient.XRange(
			ctx,
			semanticStream,
			"-",
			"+",
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream: %v",
			err,
		)
	}

	if len(semanticMessages) != 1 {
		t.Fatalf(
			"expected exactly one semantic event, got %d",
			len(semanticMessages),
		)
	}

	semanticEventID, ok :=
		semanticMessages[0].
			Values["event_id"].(string)

	if !ok {
		t.Fatalf(
			"semantic event missing event_id: %#v",
			semanticMessages[0].Values,
		)
	}

	semanticPayload, ok :=
		semanticMessages[0].
			Values["payload"].(string)

	if !ok {
		t.Fatalf(
			"semantic event missing payload: %#v",
			semanticMessages[0].Values,
		)
	}

	var observation semantics.Observation

	if err :=
		json.Unmarshal(
			[]byte(
				semanticPayload,
			),
			&observation,
		); err != nil {

		t.Fatalf(
			"decode semantic observation: %v",
			err,
		)
	}

	if observation.ID == "" {
		t.Fatal(
			"expected committed semantic observation ID",
		)
	}

	if semanticEventID !=
		observation.ID {

		t.Fatalf(
			"semantic event ID %q does not match payload observation ID %q",
			semanticEventID,
			observation.ID,
		)
	}

	if observation.EvidenceEventID !=
		turn.EventID {

		t.Fatalf(
			"expected semantic observation to reference evidence %q, got %q",
			turn.EventID,
			observation.EvidenceEventID,
		)
	}

	// ---------------------------------------------------------
	// Durable actor checkpoint
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
			"load actor checkpoint: %v",
			err,
		)
	}

	if !exists {
		t.Fatal(
			"expected durable actor checkpoint",
		)
	}

	if checkpoint.EvidenceStreamID !=
		message.ID {

		t.Fatalf(
			"expected checkpoint stream ID %q, got %q",
			message.ID,
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

	if len(
		checkpoint.Observations,
	) != 1 {

		t.Fatalf(
			"expected one checkpoint observation, got %d",
			len(checkpoint.Observations),
		)
	}

	if checkpoint.Observations[0].ID !=
		observation.ID {

		t.Fatalf(
			"checkpoint observation %q does not match semantic stream observation %q",
			checkpoint.Observations[0].ID,
			observation.ID,
		)
	}

	// ---------------------------------------------------------
	// Evidence ACK
	// ---------------------------------------------------------

	progress, err :=
		client.XGroupProgress(
			ctx,
			evidenceStream,
			consumerGroup,
		)

	if err != nil {
		t.Fatalf(
			"read evidence group progress: %v",
			err,
		)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected evidence to be ACKed, pending=%d",
			progress.Pending,
		)
	}

	// ---------------------------------------------------------
	// Actor in-memory state
	// ---------------------------------------------------------

	if actor.previousTurn == nil {
		t.Fatal(
			"actor in-memory context was not committed",
		)
	}

	if actor.previousTurn.EventID !=
		turn.EventID {

		t.Fatalf(
			"expected actor previous event %q, got %q",
			turn.EventID,
			actor.previousTurn.EventID,
		)
	}

	if len(
		actor.previousObservations,
	) != 1 {

		t.Fatalf(
			"expected one in-memory observation, got %d",
			len(actor.previousObservations),
		)
	}

	if actor.previousObservations[0].ID !=
		observation.ID {

		t.Fatalf(
			"in-memory observation %q does not match durable observation %q",
			actor.previousObservations[0].ID,
			observation.ID,
		)
	}
}

func TestConsumerProcessStaleOwnerDoesNotCommitDurableOrMemoryState(
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
			"actor-atomic-stale-%d",
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
		checkpointKey,
	)

	// Consumer still believes it owns generation 1.
	staleLease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "owner-a",

			Token: "owner-a-token",

			Fence: 1,
		}

	// Redis says generation 2 / owner B is current.
	currentLease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "owner-b",

			Token: "owner-b-token",

			Fence: 2,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		currentLease,
	)

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "evidence-event-stale",

			MeetingID: meetingID,

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "Alex will prepare the deployment by Thursday.",

			CapturedAt: time.Now().UTC(),
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

	actor :=
		New(
			meetingID,
			atomicCommitTestExtractor{},
			logger,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			staleLease,
			"stale-owner-a-consumer",
			logger,
		)

	err :=
		consumer.process(
			ctx,
			evidenceStream,
			message,
		)

	if !errors.Is(
		err,
		meetinglease.ErrLeaseLost,
	) {
		t.Fatalf(
			"expected stale owner to become lease loss, got %v",
			err,
		)
	}

	if !errors.Is(
		err,
		redisclient.ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected fenced Redis rejection, got %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// No semantic partial commit
	// ---------------------------------------------------------

	length, err :=
		rawClient.XLen(
			ctx,
			semanticStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream length: %v",
			err,
		)
	}

	if length != 0 {
		t.Fatalf(
			"stale owner published semantic events: %d",
			length,
		)
	}

	// ---------------------------------------------------------
	// No checkpoint partial commit
	// ---------------------------------------------------------

	checkpointExists, err :=
		rawClient.Exists(
			ctx,
			checkpointKey,
		).Result()

	if err != nil {
		t.Fatalf(
			"check actor checkpoint existence: %v",
			err,
		)
	}

	if checkpointExists != 0 {
		t.Fatal(
			"stale owner persisted actor checkpoint",
		)
	}

	// ---------------------------------------------------------
	// Evidence remains pending
	// ---------------------------------------------------------

	progress, err :=
		client.XGroupProgress(
			ctx,
			evidenceStream,
			consumerGroup,
		)

	if err != nil {
		t.Fatalf(
			"read evidence group progress: %v",
			err,
		)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"stale owner changed evidence PEL: pending=%d",
			progress.Pending,
		)
	}

	// ---------------------------------------------------------
	// No in-memory state commit
	// ---------------------------------------------------------

	if actor.previousTurn != nil {
		t.Fatalf(
			"stale owner committed actor turn in memory: %#v",
			actor.previousTurn,
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {

		t.Fatalf(
			"stale owner committed %d observations in memory",
			len(actor.previousObservations),
		)
	}
}

func seedActorAtomicPendingEvidence(
	t *testing.T,
	client *redisclient.Client,
	ctx context.Context,
	stream string,
	turn evidence.Turn,
) redis.XMessage {
	t.Helper()

	if err :=
		client.XGroupCreateMkStream(
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

				"schema_version": evidence.SchemaVersion,

				"event_id": turn.EventID,

				"payload": string(
					payload,
				),
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
			consumerGroup,
			"seed-consumer",
			stream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatalf(
			"deliver evidence to PEL: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected exactly one delivered evidence message, got %#v",
			streams,
		)
	}

	message :=
		streams[0].Messages[0]

	if message.ID !=
		messageID {

		t.Fatalf(
			"expected delivered stream ID %q, got %q",
			messageID,
			message.ID,
		)
	}

	return message
}

func seedActorAtomicLease(
	t *testing.T,
	rawClient *redis.Client,
	ctx context.Context,
	lease meetinglease.Lease,
) {
	t.Helper()

	if err :=
		rawClient.Set(
			ctx,
			meetinglease.LeaseKey(
				lease.MeetingID,
			),
			lease.Token,
			30*time.Second,
		).Err(); err != nil {

		t.Fatalf(
			"seed active lease: %v",
			err,
		)
	}

	if err :=
		rawClient.Set(
			ctx,
			meetinglease.FenceKey(
				lease.MeetingID,
			),
			fmt.Sprintf(
				"%d",
				lease.Fence,
			),
			0,
		).Err(); err != nil {

		t.Fatalf(
			"seed active fence: %v",
			err,
		)
	}
}

func atomicCommitRedisClients(
	t *testing.T,
) (
	*redisclient.Client,
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
		redisclient.New(
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
			"ping redisclient: %v",
			err,
		)
	}

	if err :=
		rawClient.Ping(
			pingCtx,
		).Err(); err != nil {

		t.Fatalf(
			"ping raw Redis client: %v",
			err,
		)
	}

	return client,
		rawClient
}

func cleanupActorAtomicKeys(
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
