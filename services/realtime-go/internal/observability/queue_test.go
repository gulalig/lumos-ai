package observability

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEvidenceQueueMetricsTrackDepthAndBackpressure(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		NewMetrics()

	metrics.AddEvidenceQueueDepth(
		1,
	)

	metrics.AddEvidenceQueueDepth(
		1,
	)

	metrics.AddEvidenceQueueDepth(
		-1,
	)

	metrics.IncEvidenceQueueBackpressure()
	metrics.IncEvidenceQueueBackpressure()

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
			"lumos_realtime_evidence_queue_depth 1",
			"lumos_realtime_evidence_queue_backpressure_total 2",
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
