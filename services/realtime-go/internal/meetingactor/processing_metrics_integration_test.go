package meetingactor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

type emptyMetricsExtractor struct{}

func (
	*emptyMetricsExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) (
	[]semantics.Candidate,
	error,
) {
	return nil, nil
}

func TestConsumerRecordsProcessingAndRedisCommitMetrics(
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
			"processing-metrics-%d",
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

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "metrics-owner",

			Token: "metrics-owner-token",

			Fence: 1,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	turn, err :=
		evidence.NewTurn(
			meetingID,
			"participant-1",
			"track-1",
			1,
			"We should review this tomorrow.",
			time.Now().
				UTC(),
		)

	if err != nil {
		t.Fatalf(
			"create evidence turn: %v",
			err,
		)
	}

	message :=
		seedActorAtomicPendingEvidence(
			t,
			client,
			ctx,
			evidenceStream,
			turn,
		)

	metrics :=
		observability.NewMetrics()

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
			&emptyMetricsExtractor{},
			logger,
			metrics,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"metrics-consumer",
			logger,
		)

	if err :=
		consumer.process(
			ctx,
			evidenceStream,
			message,
		); err != nil {

		t.Fatalf(
			"process evidence: %v",
			err,
		)
	}

	request :=
		httptest.NewRequest(
			http.MethodGet,
			"/metrics",
			nil,
		)

	recorder :=
		httptest.NewRecorder()

	metrics.Handler().
		ServeHTTP(
			recorder,
			request,
		)

	if recorder.Code !=
		http.StatusOK {

		t.Fatalf(
			"metrics endpoint returned %d",
			recorder.Code,
		)
	}

	body :=
		recorder.Body.String()

	expected :=
		[]string{
			"lumos_realtime_evidence_processing_seconds_count 1",
			"lumos_realtime_redis_commit_seconds_count 1",
			"lumos_realtime_semantic_extraction_seconds_count 1",
		}

	for _, metric := range expected {

		if !strings.Contains(
			body,
			metric,
		) {

			t.Fatalf(
				"metrics output missing %q",
				metric,
			)
		}
	}
}
