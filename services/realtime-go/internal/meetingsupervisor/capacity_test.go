package meetingsupervisor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"

	"lumos/realtime-go/internal/meetinglease"
)

type capacityRuntime struct {
	mu sync.Mutex

	started map[string]int
	stopped map[string]int
}

func newCapacityRuntime() *capacityRuntime {
	return &capacityRuntime{
		started: make(
			map[string]int,
		),

		stopped: make(
			map[string]int,
		),
	}
}

func (
	r *capacityRuntime,
) Run(
	ctx context.Context,
	lease meetinglease.Lease,
	_ string,
) error {
	r.mu.Lock()

	r.started[lease.MeetingID]++

	r.mu.Unlock()

	<-ctx.Done()

	r.mu.Lock()

	r.stopped[lease.MeetingID]++

	r.mu.Unlock()

	return nil
}

func TestSupervisorDefersMeetingWhenInstanceCapacityIsFull(
	t *testing.T,
) {
	runtime :=
		newCapacityRuntime()

	leases :=
		newFakeLeaseManager()

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	supervisor, err :=
		New(
			runtime,
			leases,
			"instance-capacity",
			logger,
		)

	if err != nil {
		t.Fatalf(
			"create supervisor: %v",
			err,
		)
	}

	ctx, cancel :=
		context.WithCancel(
			context.Background(),
		)

	defer cancel()

	for index := range maxConcurrentMeetingRuntimes {

		meetingID :=
			fmt.Sprintf(
				"meeting-%d",
				index,
			)

		roomName :=
			fmt.Sprintf(
				"room-%d",
				index,
			)

		if err :=
			supervisor.startMeeting(
				ctx,
				meetingID,
				roomName,
			); err != nil {

			t.Fatalf(
				"start meeting %d: %v",
				index,
				err,
			)
		}
	}

	waitUntil(
		t,
		"all capacity runtimes started",
		func() bool {
			runtime.mu.Lock()
			defer runtime.mu.Unlock()

			return len(
				runtime.started,
			) ==
				maxConcurrentMeetingRuntimes
		},
	)

	leases.mu.Lock()

	acquireCallsBefore :=
		leases.acquireCalls["instance-capacity"]

	leases.mu.Unlock()

	if acquireCallsBefore !=
		maxConcurrentMeetingRuntimes {

		t.Fatalf(
			"expected %d lease acquisitions, got %d",
			maxConcurrentMeetingRuntimes,
			acquireCallsBefore,
		)
	}

	// ---------------------------------------------------------
	// Capacity is full.
	//
	// Critical property:
	// the supervisor must NOT acquire a distributed lease for
	// work this instance cannot run.
	// ---------------------------------------------------------

	if err :=
		supervisor.startMeeting(
			ctx,
			"meeting-over-capacity",
			"room-over-capacity",
		); err != nil {

		t.Fatalf(
			"defer over-capacity meeting: %v",
			err,
		)
	}

	leases.mu.Lock()

	acquireCallsAfter :=
		leases.acquireCalls["instance-capacity"]

	_, overflowLeaseExists :=
		leases.current["meeting-over-capacity"]

	leases.mu.Unlock()

	if acquireCallsAfter !=
		acquireCallsBefore {

		t.Fatalf(
			"over-capacity meeting unexpectedly attempted lease acquisition: before=%d after=%d",
			acquireCallsBefore,
			acquireCallsAfter,
		)
	}

	if overflowLeaseExists {
		t.Fatal(
			"over-capacity meeting unexpectedly owns a distributed lease",
		)
	}

	supervisor.mu.Lock()

	runningCount :=
		len(
			supervisor.running,
		)

	supervisor.mu.Unlock()

	if runningCount !=
		maxConcurrentMeetingRuntimes {

		t.Fatalf(
			"expected %d running meetings, got %d",
			maxConcurrentMeetingRuntimes,
			runningCount,
		)
	}

	// ---------------------------------------------------------
	// Free one slot.
	// ---------------------------------------------------------

	supervisor.stopMeeting(
		"meeting-0",
		"capacity test",
	)

	waitUntil(
		t,
		"runtime capacity slot released",
		func() bool {
			supervisor.mu.Lock()
			defer supervisor.mu.Unlock()

			return len(
				supervisor.running,
			) ==
				maxConcurrentMeetingRuntimes-1
		},
	)

	// ---------------------------------------------------------
	// The deferred meeting can now acquire ownership and run.
	// ---------------------------------------------------------

	if err :=
		supervisor.startMeeting(
			ctx,
			"meeting-over-capacity",
			"room-over-capacity",
		); err != nil {

		t.Fatalf(
			"start meeting after capacity release: %v",
			err,
		)
	}

	waitUntil(
		t,
		"deferred meeting started after capacity release",
		func() bool {
			runtime.mu.Lock()
			defer runtime.mu.Unlock()

			return runtime.started["meeting-over-capacity"] == 1
		},
	)

	leases.mu.Lock()

	_, overflowLeaseExists =
		leases.current["meeting-over-capacity"]

	leases.mu.Unlock()

	if !overflowLeaseExists {
		t.Fatal(
			"expected deferred meeting to acquire lease after capacity became available",
		)
	}

	cancel()

	supervisor.stopAll()

	waitUntil(
		t,
		"all runtimes stopped",
		func() bool {
			supervisor.mu.Lock()
			defer supervisor.mu.Unlock()

			return len(
				supervisor.running,
			) == 0
		},
	)
}
