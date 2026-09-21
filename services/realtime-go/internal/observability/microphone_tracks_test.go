package observability

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestActiveMicrophoneTracksAggregatesAcrossMeetings(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		NewMetrics()

	metrics.SetMeetingActiveMicrophoneTracks(
		"meeting-a",
		2,
	)

	metrics.SetMeetingActiveMicrophoneTracks(
		"meeting-b",
		3,
	)

	assertActiveMicrophoneTracksMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 5",
	)

	metrics.SetMeetingActiveMicrophoneTracks(
		"meeting-a",
		1,
	)

	assertActiveMicrophoneTracksMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 4",
	)

	metrics.RemoveMeetingActiveMicrophoneTracks(
		"meeting-b",
	)

	assertActiveMicrophoneTracksMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 1",
	)

	metrics.SetMeetingActiveMicrophoneTracks(
		"meeting-a",
		0,
	)

	assertActiveMicrophoneTracksMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 0",
	)
}

func assertActiveMicrophoneTracksMetric(
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
