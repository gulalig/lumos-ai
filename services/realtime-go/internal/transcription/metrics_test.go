package transcription

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"lumos/realtime-go/internal/observability"
)

func TestMicrophoneTrackMetricsFollowLifecycle(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		observability.NewMetrics()

	managerA :=
		&Manager{
			meetingID: "meeting-a",

			metrics: metrics,

			tracks: make(
				map[string]*trackState,
			),
		}

	managerB :=
		&Manager{
			meetingID: "meeting-b",

			metrics: metrics,

			tracks: make(
				map[string]*trackState,
			),
		}

	stateA1 :=
		&trackState{
			cancel: func() {},
		}

	stateA2 :=
		&trackState{
			cancel: func() {},
		}

	stateB1 :=
		&trackState{
			cancel: func() {},
		}

	reserved, err :=
		managerA.reserveTrack(
			"track-a1",
			stateA1,
		)

	if err != nil ||
		!reserved {

		t.Fatalf(
			"reserve track-a1: reserved=%v err=%v",
			reserved,
			err,
		)
	}

	reserved, err =
		managerA.reserveTrack(
			"track-a2",
			stateA2,
		)

	if err != nil ||
		!reserved {

		t.Fatalf(
			"reserve track-a2: reserved=%v err=%v",
			reserved,
			err,
		)
	}

	reserved, err =
		managerB.reserveTrack(
			"track-b1",
			stateB1,
		)

	if err != nil ||
		!reserved {

		t.Fatalf(
			"reserve track-b1: reserved=%v err=%v",
			reserved,
			err,
		)
	}

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 3",
	)

	// Duplicate subscription callback must not change
	// either capacity or the metric.
	reserved, err =
		managerA.reserveTrack(
			"track-a1",
			&trackState{
				cancel: func() {},
			},
		)

	if err != nil {
		t.Fatalf(
			"duplicate reserve: %v",
			err,
		)
	}

	if reserved {
		t.Fatal(
			"duplicate track unexpectedly reserved another slot",
		)
	}

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 3",
	)

	// LiveKit unsubscribe path.
	managerA.stopTrack(
		"track-a1",
	)

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 2",
	)

	// Worker self-exit path.
	managerB.removeTrack(
		"track-b1",
		stateB1,
	)

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 1",
	)

	// Calling remove again must not double-decrement.
	managerB.removeTrack(
		"track-b1",
		stateB1,
	)

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 1",
	)

	// Runtime shutdown path.
	managerA.Close()

	assertMicrophoneTrackMetric(
		t,
		metrics,
		"lumos_realtime_active_microphone_tracks 0",
	)
}

func assertMicrophoneTrackMetric(
	t *testing.T,
	metrics *observability.Metrics,
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
