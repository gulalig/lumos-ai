package observability

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMetricsExposeRealtimeCollectors(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		NewMetrics()

	metrics.SetActiveMeetings(
		3,
	)

	metrics.SetActiveMicrophoneTracks(
		7,
	)

	metrics.SetEvidenceQueueDepth(
		11,
	)

	metrics.SetEvidencePending(
		5,
	)

	metrics.ObserveEvidenceProcessing(
		250 * time.Millisecond,
	)

	metrics.ObserveSemanticExtraction(
		750 * time.Millisecond,
	)

	metrics.ObserveRedisCommit(
		15 * time.Millisecond,
	)

	metrics.ObserveLeaseTakeover(
		2 * time.Second,
	)

	metrics.IncFailure(
		"meeting_actor",
		"semantic_extraction",
	)

	metrics.IncDeadLetter()
	metrics.IncLeaseLoss()
	metrics.IncCapacityDeferral()

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
			"expected HTTP 200, got %d",
			recorder.Code,
		)
	}

	body :=
		recorder.Body.String()

	expectedMetrics :=
		[]string{
			"lumos_realtime_active_meetings 3",
			"lumos_realtime_active_microphone_tracks 7",
			"lumos_realtime_evidence_queue_depth 11",
			"lumos_realtime_evidence_pending 5",
			"lumos_realtime_evidence_processing_seconds_count 1",
			"lumos_realtime_semantic_extraction_seconds_count 1",
			"lumos_realtime_redis_commit_seconds_count 1",
			"lumos_realtime_lease_takeover_seconds_count 1",
			"lumos_realtime_failures_total",
			"lumos_realtime_dead_letters_total 1",
			"lumos_realtime_lease_losses_total 1",
			"lumos_realtime_capacity_deferrals_total 1",
		}

	for _, expected := range expectedMetrics {

		if !strings.Contains(
			body,
			expected,
		) {

			t.Fatalf(
				"metrics output missing %q",
				expected,
			)
		}
	}
}
