package observability

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestEvidencePendingAggregatesAcrossMeetings(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		NewMetrics()

	metrics.SetMeetingEvidencePending(
		"meeting-a",
		2,
	)

	metrics.SetMeetingEvidencePending(
		"meeting-b",
		3,
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		5,
	)

	// Updating meeting-a must replace its previous contribution,
	// not add another copy.
	metrics.SetMeetingEvidencePending(
		"meeting-a",
		1,
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		4,
	)

	// A meeting that is no longer local must stop contributing
	// to this instance's pending gauge.
	metrics.RemoveMeetingEvidencePending(
		"meeting-b",
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		1,
	)

	// Defensive guard against impossible negative PEL values.
	metrics.SetMeetingEvidencePending(
		"meeting-a",
		-10,
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		0,
	)

	metrics.SetMeetingEvidencePending(
		"meeting-a",
		2,
	)

	metrics.AddMeetingEvidencePending(
		"meeting-a",
		3,
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		5,
	)

	metrics.AddMeetingEvidencePending(
		"meeting-a",
		-10,
	)

	assertEvidencePendingMetric(
		t,
		metrics,
		0,
	)
}

func assertEvidencePendingMetric(
	t *testing.T,
	metrics *Metrics,
	expected int64,
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

	expectedLine :=
		"lumos_realtime_evidence_pending " +
			strconv.FormatInt(
				expected,
				10,
			)

	if !strings.Contains(
		recorder.Body.String(),
		expectedLine,
	) {
		t.Fatalf(
			"expected metrics output to contain %q",
			expectedLine,
		)
	}
}
