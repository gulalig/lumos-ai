package observability

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEvidenceGroupLagAggregatesAcrossMeetings(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		NewMetrics()

	metrics.SetMeetingEvidenceGroupLag(
		"meeting-a",
		4,
	)

	metrics.SetMeetingEvidenceGroupLag(
		"meeting-b",
		7,
	)

	assertEvidenceGroupLagMetric(
		t,
		metrics,
		"lumos_realtime_evidence_group_lag 11",
	)

	metrics.SetMeetingEvidenceGroupLag(
		"meeting-a",
		2,
	)

	assertEvidenceGroupLagMetric(
		t,
		metrics,
		"lumos_realtime_evidence_group_lag 9",
	)

	// Redis uses -1 when lag cannot be determined.
	// It must not corrupt the previously known value.
	metrics.SetMeetingEvidenceGroupLag(
		"meeting-a",
		-1,
	)

	assertEvidenceGroupLagMetric(
		t,
		metrics,
		"lumos_realtime_evidence_group_lag 9",
	)

	metrics.RemoveMeetingEvidenceGroupLag(
		"meeting-b",
	)

	assertEvidenceGroupLagMetric(
		t,
		metrics,
		"lumos_realtime_evidence_group_lag 2",
	)

	metrics.RemoveMeetingEvidenceGroupLag(
		"meeting-a",
	)

	assertEvidenceGroupLagMetric(
		t,
		metrics,
		"lumos_realtime_evidence_group_lag 0",
	)
}

func assertEvidenceGroupLagMetric(
	t *testing.T,
	metrics *Metrics,
	expected string,
) {
	t.Helper()

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

	if !strings.Contains(
		recorder.Body.String(),
		expected,
	) {

		t.Fatalf(
			"metrics output missing %q",
			expected,
		)
	}
}
