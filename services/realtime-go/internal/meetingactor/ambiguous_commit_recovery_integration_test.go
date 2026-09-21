package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

type restartRestoreSignalHandler struct {
	once     sync.Once
	restored chan struct{}
}

func newRestartRestoreSignalHandler() *restartRestoreSignalHandler {
	return &restartRestoreSignalHandler{
		restored: make(chan struct{}),
	}
}

func (h *restartRestoreSignalHandler) Enabled(
	_ context.Context,
	_ slog.Level,
) bool {
	return true
}

func (h *restartRestoreSignalHandler) Handle(
	_ context.Context,
	record slog.Record,
) error {
	if record.Message ==
		"meeting actor durable context restored" {

		h.once.Do(
			func() {
				close(
					h.restored,
				)
			},
		)
	}

	return nil
}

func (h *restartRestoreSignalHandler) WithAttrs(
	_ []slog.Attr,
) slog.Handler {
	return h
}

func (h *restartRestoreSignalHandler) WithGroup(
	_ string,
) slog.Handler {
	return h
}

type restartMustNotExtract struct {
	calls atomic.Int64
}

func (e *restartMustNotExtract) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]semantics.Candidate, error) {
	e.calls.Add(1)

	return nil,
		errors.New(
			"extractor must not run for already committed evidence",
		)
}

func TestConsumerRestartRestoresAmbiguousCommittedCheckpointWithoutDuplicate(
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
			"ambiguous-recovery-%d",
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

	// ---------------------------------------------------------
	// Owner A
	// ---------------------------------------------------------

	leaseA :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "owner-a",
			Token:     "owner-a-token",
			Fence:     1,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		leaseA,
	)

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "ambiguous-evidence-1",

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

	ownerALogger :=
		slog.New(
			newRestartRestoreSignalHandler(),
		)

	actorA :=
		New(
			meetingID,
			atomicCommitTestExtractor{},
			ownerALogger,
		)

	// ---------------------------------------------------------
	// Prepare semantic state.
	// ---------------------------------------------------------
	//
	// IMPORTANT:
	// We intentionally do NOT call actorA.commitPrepared().
	//
	// This models exactly:
	//
	// Redis commit succeeded
	// client response was lost
	// Actor memory never advanced
	// ---------------------------------------------------------

	prepared, err :=
		actorA.PrepareEvidence(
			ctx,
			string(payload),
		)

	if err != nil {
		t.Fatalf(
			"prepare evidence: %v",
			err,
		)
	}

	if len(
		prepared.Observations,
	) != 1 {
		t.Fatalf(
			"expected one prepared observation, got %d",
			len(prepared.Observations),
		)
	}

	semanticEntries :=
		make(
			[]redisclient.FencedStreamEntry,
			0,
			len(
				prepared.Observations,
			),
		)

	for _, observation := range prepared.Observations {

		entry, err :=
			redisstream.EncodeSemanticStreamEntry(
				observation,
			)

		if err != nil {
			t.Fatalf(
				"encode semantic stream entry: %v",
				err,
			)
		}

		semanticEntries =
			append(
				semanticEntries,
				entry,
			)
	}

	checkpoint :=
		prepared.ContextCheckpoint(
			message.ID,
		)

	checkpointPayload, err :=
		EncodeContextCheckpoint(
			checkpoint,
		)

	if err != nil {
		t.Fatalf(
			"encode actor checkpoint: %v",
			err,
		)
	}

	// ---------------------------------------------------------
	// Durable Redis commit succeeds.
	// ---------------------------------------------------------

	committed, err :=
		client.FencedXAddBatchAckAndSet(
			ctx,

			leaseKey,
			fenceKey,

			leaseA.Token,
			leaseA.Fence,

			evidenceStream,
			consumerGroup,
			message.ID,

			checkpointKey,
			checkpointPayload,

			semanticStream,
			semanticEntries,
		)

	if err != nil {
		t.Fatalf(
			"commit durable ambiguous state: %v",
			err,
		)
	}

	if committed != 1 {
		t.Fatalf(
			"expected one committed semantic observation, got %d",
			committed,
		)
	}

	// ---------------------------------------------------------
	// Actor A memory intentionally remains stale.
	// ---------------------------------------------------------

	if actorA.previousTurn != nil {
		t.Fatal(
			"owner A memory unexpectedly advanced",
		)
	}

	if len(
		actorA.previousObservations,
	) != 0 {
		t.Fatalf(
			"owner A memory unexpectedly contains %d observations",
			len(actorA.previousObservations),
		)
	}

	semanticCountBeforeRestart, err :=
		rawClient.XLen(
			ctx,
			semanticStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream before restart: %v",
			err,
		)
	}

	if semanticCountBeforeRestart != 1 {
		t.Fatalf(
			"expected one durable semantic event before restart, got %d",
			semanticCountBeforeRestart,
		)
	}

	pendingBeforeRestart, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read pending state before restart: %v",
			err,
		)
	}

	if pendingBeforeRestart.Count != 0 {
		t.Fatalf(
			"expected ambiguous committed evidence to already be ACKed, pending=%d",
			pendingBeforeRestart.Count,
		)
	}

	// ---------------------------------------------------------
	// Owner B takes over.
	// ---------------------------------------------------------

	leaseB :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "owner-b",
			Token:     "owner-b-token",
			Fence:     2,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		leaseB,
	)

	restoreHandler :=
		newRestartRestoreSignalHandler()

	loggerB :=
		slog.New(
			restoreHandler,
		)

	extractorB :=
		&restartMustNotExtract{}

	actorB :=
		New(
			meetingID,
			extractorB,
			loggerB,
		)

	consumerB :=
		NewConsumer(
			client,
			actorB,
			leaseB,
			"owner-b-consumer",
			loggerB,
		)

	runCtx, cancelRun :=
		context.WithCancel(
			context.Background(),
		)

	runResult :=
		make(
			chan error,
			1,
		)

	go func() {
		runResult <- consumerB.Run(
			runCtx,
		)
	}()

	// ---------------------------------------------------------
	// Wait until production Consumer.Run confirms restore.
	// ---------------------------------------------------------

	select {
	case <-restoreHandler.restored:

	case <-time.After(
		3 * time.Second,
	):
		cancelRun()

		t.Fatal(
			"timed out waiting for actor checkpoint restore",
		)
	}

	cancelRun()

	select {
	case err := <-runResult:
		if err != nil {
			t.Fatalf(
				"consumer restart returned error: %v",
				err,
			)
		}

	case <-time.After(
		4 * time.Second,
	):
		t.Fatal(
			"consumer did not stop after cancellation",
		)
	}

	// ---------------------------------------------------------
	// Owner B memory must now equal durable checkpoint.
	// ---------------------------------------------------------

	if actorB.previousTurn == nil {
		t.Fatal(
			"owner B did not restore previous turn",
		)
	}

	if actorB.previousTurn.EventID !=
		turn.EventID {

		t.Fatalf(
			"expected restored event %q, got %q",
			turn.EventID,
			actorB.previousTurn.EventID,
		)
	}

	if len(
		actorB.previousObservations,
	) != 1 {

		t.Fatalf(
			"expected one restored observation, got %d",
			len(actorB.previousObservations),
		)
	}

	if actorB.previousObservations[0].ID !=
		prepared.Observations[0].ID {

		t.Fatalf(
			"restored observation %q does not match committed observation %q",
			actorB.previousObservations[0].ID,
			prepared.Observations[0].ID,
		)
	}

	// ---------------------------------------------------------
	// ACKed evidence must NOT be extracted again.
	// ---------------------------------------------------------

	if extractorB.calls.Load() != 0 {
		t.Fatalf(
			"already committed evidence was extracted again %d times",
			extractorB.calls.Load(),
		)
	}

	// ---------------------------------------------------------
	// No duplicate semantic event.
	// ---------------------------------------------------------

	semanticCountAfterRestart, err :=
		rawClient.XLen(
			ctx,
			semanticStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream after restart: %v",
			err,
		)
	}

	if semanticCountAfterRestart !=
		semanticCountBeforeRestart {

		t.Fatalf(
			"restart produced duplicate semantic events: before=%d after=%d",
			semanticCountBeforeRestart,
			semanticCountAfterRestart,
		)
	}

	// ---------------------------------------------------------
	// Evidence must remain fully ACKed.
	// ---------------------------------------------------------

	pendingAfterRestart, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read pending state after restart: %v",
			err,
		)
	}

	if pendingAfterRestart.Count != 0 {
		t.Fatalf(
			"restart unexpectedly recreated pending evidence: %d",
			pendingAfterRestart.Count,
		)
	}
}
