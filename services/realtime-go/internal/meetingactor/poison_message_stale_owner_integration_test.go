package meetingactor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

func TestStaleOwnerCannotDeadLetterPoisonEvidence(
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
			"poison-stale-owner-%d",
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

	deadLetterStream :=
		redisstream.EvidenceDeadLetterStreamKey(
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
		deadLetterStream,
		checkpointKey,
	)

	// ---------------------------------------------------------
	// Consumer A believes it still owns fence 1.
	// ---------------------------------------------------------

	staleLease :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "owner-a",
			Token:     "owner-a-token",
			Fence:     1,
		}

	// ---------------------------------------------------------
	// Redis says owner B / fence 2 is current.
	// ---------------------------------------------------------

	currentLease :=
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
		currentLease,
	)

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "poison-stale-evidence-1",

			MeetingID: meetingID,

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "Alex will prepare the deployment.",

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
			poisonMessageExtractor{},
			logger,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			staleLease,
			"stale-poison-consumer",
			logger,
		)

	currentMessage :=
		message

	// ---------------------------------------------------------
	// Push Redis PEL delivery count to the poison threshold.
	//
	// First delivery already happened inside
	// seedActorAtomicPendingEvidence(), therefore four more
	// XAUTOCLAIM operations bring the total to 5.
	// ---------------------------------------------------------

	for delivery :=
		int64(2); delivery <=
		maxEvidenceDeliveryCount; delivery++ {

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
				"claim delivery %d: %v",
				delivery,
				err,
			)
		}

		if len(claimed) != 1 {
			t.Fatalf(
				"expected one claimed message on delivery %d, got %d",
				delivery,
				len(claimed),
			)
		}

		if claimed[0].ID !=
			message.ID {

			t.Fatalf(
				"expected claimed message %q, got %q",
				message.ID,
				claimed[0].ID,
			)
		}

		currentMessage =
			claimed[0]
	}

	pendingBefore, exists, err :=
		client.XPendingEntry(
			ctx,
			evidenceStream,
			consumerGroup,
			message.ID,
		)

	if err != nil {
		t.Fatalf(
			"read pending metadata: %v",
			err,
		)
	}

	if !exists {
		t.Fatal(
			"expected poison evidence to remain pending",
		)
	}

	if pendingBefore.DeliveryCount !=
		maxEvidenceDeliveryCount {

		t.Fatalf(
			"expected delivery count %d, got %d",
			maxEvidenceDeliveryCount,
			pendingBefore.DeliveryCount,
		)
	}

	// ---------------------------------------------------------
	// Semantic processing fails normally.
	// ---------------------------------------------------------

	processErr :=
		consumer.process(
			ctx,
			evidenceStream,
			currentMessage,
		)

	if processErr == nil {
		t.Fatal(
			"expected poison semantic processing failure",
		)
	}

	if isFatalProcessError(
		processErr,
	) {
		t.Fatalf(
			"semantic extraction failure itself must remain retryable: %v",
			processErr,
		)
	}

	// ---------------------------------------------------------
	// Delivery budget is exhausted, so Consumer tries DLQ.
	//
	// But Consumer A is stale. Redis fencing MUST reject the
	// DLQ XADD + source XACK.
	// ---------------------------------------------------------

	deadLettered, fatalErr :=
		consumer.resolveProcessFailure(
			ctx,
			evidenceStream,
			currentMessage,
			processErr,
		)

	if deadLettered {
		t.Fatal(
			"stale owner unexpectedly dead-lettered evidence",
		)
	}

	if fatalErr == nil {
		t.Fatal(
			"expected stale-owner DLQ attempt to be fatal",
		)
	}

	if !errors.Is(
		fatalErr,
		meetinglease.ErrLeaseLost,
	) {
		t.Fatalf(
			"expected meetinglease.ErrLeaseLost, got %v",
			fatalErr,
		)
	}

	if !errors.Is(
		fatalErr,
		redisclient.ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected underlying ErrFencedWriteRejected, got %v",
			fatalErr,
		)
	}

	// ---------------------------------------------------------
	// No DLQ mutation.
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

	if dlqCount != 0 {
		t.Fatalf(
			"stale owner wrote %d DLQ entries",
			dlqCount,
		)
	}

	// ---------------------------------------------------------
	// Source evidence must remain pending.
	// ---------------------------------------------------------

	pendingAfter, err :=
		rawClient.XPending(
			ctx,
			evidenceStream,
			consumerGroup,
		).Result()

	if err != nil {
		t.Fatalf(
			"read final pending state: %v",
			err,
		)
	}

	if pendingAfter.Count != 1 {
		t.Fatalf(
			"stale owner unexpectedly ACKed source evidence, pending=%d",
			pendingAfter.Count,
		)
	}

	// ---------------------------------------------------------
	// No semantic output / checkpoint / Actor mutation.
	// ---------------------------------------------------------

	semanticCount, err :=
		rawClient.XLen(
			ctx,
			semanticStream,
		).Result()

	if err != nil {
		t.Fatalf(
			"read semantic stream: %v",
			err,
		)
	}

	if semanticCount != 0 {
		t.Fatalf(
			"stale poison processing produced %d semantic entries",
			semanticCount,
		)
	}

	_, checkpointExists, err :=
		NewContextStore(
			client,
		).Load(
			ctx,
			meetingID,
		)

	if err != nil {
		t.Fatalf(
			"load actor checkpoint: %v",
			err,
		)
	}

	if checkpointExists {
		t.Fatal(
			"stale poison evidence unexpectedly advanced checkpoint",
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"stale poison evidence unexpectedly advanced actor memory",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"stale poison evidence unexpectedly advanced observations: %d",
			len(actor.previousObservations),
		)
	}
}
