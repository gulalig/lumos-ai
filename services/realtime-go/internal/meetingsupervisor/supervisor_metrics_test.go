package meetingsupervisor

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/meetinglifecycle"
	"lumos/realtime-go/internal/observability"
)

func TestSupervisorRecordsActiveMeetingMetric(
	t *testing.T,
) {
	leases :=
		newFakeLeaseManager()

	runtime :=
		newFakeRuntime()

	metrics :=
		observability.NewMetrics()

	supervisor, err :=
		New(
			runtime,
			leases,
			"metrics-instance",
			testLogger(),
			metrics,
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx :=
		context.Background()

	if err :=
		supervisor.Sync(
			ctx,
			[]meetinglifecycle.ActiveMeeting{
				{
					MeetingID: "metrics-meeting",

					RoomName: "metrics-room",
				},
			},
		); err != nil {

		t.Fatal(err)
	}

	waitSignal(
		t,
		runtime.started,
		"metrics runtime start",
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_active_meetings 1",
	)

	supervisor.stopMeeting(
		"metrics-meeting",
		"metrics test cleanup",
	)

	waitSignal(
		t,
		runtime.stopped,
		"metrics runtime stop",
	)

	waitUntil(
		t,
		"metrics runtime removal",
		func() bool {
			return !supervisorRunning(
				supervisor,
				"metrics-meeting",
			)
		},
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_active_meetings 0",
	)
}

func TestSupervisorRecordsCapacityDeferralMetric(
	t *testing.T,
) {
	leases :=
		newFakeLeaseManager()

	runtime :=
		newFakeRuntime()

	metrics :=
		observability.NewMetrics()

	supervisor, err :=
		New(
			runtime,
			leases,
			"metrics-capacity-instance",
			testLogger(),
			metrics,
		)

	if err != nil {
		t.Fatal(err)
	}

	// Fill every local runtime reservation without actually
	// starting meetings. This isolates capacity behavior.
	for range maxConcurrentMeetingRuntimes {

		supervisor.runtimeSlots <- struct{}{}
	}

	defer func() {
		for len(
			supervisor.runtimeSlots,
		) > 0 {

			<-supervisor.runtimeSlots
		}
	}()

	if err :=
		supervisor.Sync(
			context.Background(),
			[]meetinglifecycle.ActiveMeeting{
				{
					MeetingID: "deferred-meeting",

					RoomName: "deferred-room",
				},
			},
		); err != nil {

		t.Fatal(err)
	}

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_capacity_deferrals_total 1",
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_active_meetings 0",
	)

	select {
	case <-runtime.started:
		t.Fatal(
			"runtime must not start while instance capacity is full",
		)

	default:
	}
}

func assertSupervisorMetric(
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

func TestSupervisorRecordsLeaseLossExactlyOnce(
	t *testing.T,
) {
	leases :=
		newFakeLeaseManager()

	runtime :=
		newFakeRuntime()

	metrics :=
		observability.NewMetrics()

	supervisor, err :=
		New(
			runtime,
			leases,
			"lease-loss-instance",
			testLogger(),
			metrics,
		)

	if err != nil {
		t.Fatal(err)
	}

	entry :=
		&runningMeeting{
			meetingID: "lease-loss-meeting",

			roomName: "lease-loss-room",

			lease: meetinglease.Lease{
				MeetingID: "lease-loss-meeting",

				OwnerID: "lease-loss-instance",

				Token: "lease-loss-token",

				Fence: 1,
			},
		}

	supervisor.mu.Lock()

	supervisor.running[entry.meetingID] = entry

	metrics.SetActiveMeetings(
		len(
			supervisor.running,
		),
	)

	supervisor.mu.Unlock()

	// Simulate the same logical ownership-loss event being
	// visible through BOTH channels.
	//
	// It must still increment lease_losses_total only once.
	runtimeErr :=
		fmt.Errorf(
			"runtime observed fenced rejection: %w",
			meetinglease.ErrLeaseLost,
		)

	keeperErr :=
		fmt.Errorf(
			"lease renewal failed: %w",
			meetinglease.ErrLeaseLost,
		)

	supervisor.handleRuntimeExit(
		entry,
		runtimeErr,
		keeperErr,
		context.Background(),
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_lease_losses_total 1",
	)

	assertSupervisorMetric(
		t,
		metrics,
		`lumos_realtime_failures_total{component="meeting_runtime",reason="lease_lost"} 1`,
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_active_meetings 0",
	)
}

func TestSupervisorRecordsObservedLeaseTakeover(
	t *testing.T,
) {
	leases :=
		newFakeLeaseManager()

	runtimeA :=
		newFakeRuntime()

	runtimeB :=
		newFakeRuntime()

	metrics :=
		observability.NewMetrics()

	supervisorA, err :=
		New(
			runtimeA,
			leases,
			"takeover-instance-a",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	supervisorB, err :=
		New(
			runtimeB,
			leases,
			"takeover-instance-b",
			testLogger(),
			metrics,
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx :=
		context.Background()

	active :=
		[]meetinglifecycle.ActiveMeeting{
			{
				MeetingID: "takeover-meeting",

				RoomName: "takeover-room",
			},
		}

	// A becomes the first owner.
	if err :=
		supervisorA.Sync(
			ctx,
			active,
		); err != nil {

		t.Fatal(err)
	}

	waitSignal(
		t,
		runtimeA.started,
		"instance A runtime start",
	)

	// B observes the meeting as owned elsewhere.
	if err :=
		supervisorB.Sync(
			ctx,
			active,
		); err != nil {

		t.Fatal(err)
	}

	assertNotSignaled(
		t,
		runtimeB.started,
		"instance B runtime start before takeover",
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_lease_takeover_seconds_count 0",
	)

	// Simulate previous-owner TTL expiry.
	leases.expire(
		"takeover-meeting",
	)

	// Periodic reconciliation would perform this retry.
	supervisorB.reconcile(
		ctx,
	)

	waitSignal(
		t,
		runtimeB.started,
		"instance B takeover runtime start",
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_lease_takeover_seconds_count 1",
	)

	// Reconciliation while already locally running must
	// not record another takeover observation.
	supervisorB.reconcile(
		ctx,
	)

	assertSupervisorMetric(
		t,
		metrics,
		"lumos_realtime_lease_takeover_seconds_count 1",
	)

	supervisorA.stopMeeting(
		"takeover-meeting",
		"test cleanup",
	)

	waitSignal(
		t,
		runtimeA.stopped,
		"instance A runtime stop",
	)

	waitUntil(
		t,
		"instance A removal",
		func() bool {
			return !supervisorRunning(
				supervisorA,
				"takeover-meeting",
			)
		},
	)

	supervisorB.stopMeeting(
		"takeover-meeting",
		"test cleanup",
	)

	waitSignal(
		t,
		runtimeB.stopped,
		"instance B runtime stop",
	)

	waitUntil(
		t,
		"instance B removal",
		func() bool {
			return !supervisorRunning(
				supervisorB,
				"takeover-meeting",
			)
		},
	)
}
