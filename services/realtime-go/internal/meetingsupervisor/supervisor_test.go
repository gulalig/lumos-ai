package meetingsupervisor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/meetinglifecycle"
)

type fakeRuntime struct {
	started chan struct{}
	stopped chan struct{}

	lease    meetinglease.Lease
	roomName string

	startOnce sync.Once
	stopOnce  sync.Once
}

func newFakeRuntime() *fakeRuntime {
	return &fakeRuntime{
		started: make(chan struct{}),
		stopped: make(chan struct{}),
	}
}

func (r *fakeRuntime) Run(
	ctx context.Context,
	lease meetinglease.Lease,
	roomName string,
) error {
	r.lease = lease
	r.roomName = roomName

	r.startOnce.Do(func() {
		close(r.started)
	})

	<-ctx.Done()

	r.stopOnce.Do(func() {
		close(r.stopped)
	})

	return nil
}

type fakeLeaseManager struct {
	mu sync.Mutex

	current map[string]meetinglease.Lease

	nextFence int64

	acquireCalls map[string]int

	interval time.Duration
}

func newFakeLeaseManager() *fakeLeaseManager {
	return &fakeLeaseManager{
		current: make(
			map[string]meetinglease.Lease,
		),

		acquireCalls: make(
			map[string]int,
		),

		// Keep automatic renewal out of the way.
		// Tests explicitly simulate expiry.
		interval: time.Hour,
	}
}

func (m *fakeLeaseManager) Acquire(
	_ context.Context,
	meetingID string,
	ownerID string,
) (
	meetinglease.Lease,
	bool,
	error,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.acquireCalls[ownerID]++

	if _, exists :=
		m.current[meetingID]; exists {

		return meetinglease.Lease{},
			false,
			nil
	}

	m.nextFence++

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: ownerID,

			Token: fmt.Sprintf(
				"%s-token-%d",
				ownerID,
				m.nextFence,
			),

			Fence: m.nextFence,
		}

	m.current[meetingID] =
		lease

	return lease,
		true,
		nil
}

func (m *fakeLeaseManager) Renew(
	_ context.Context,
	lease meetinglease.Lease,
) (
	bool,
	error,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	current, exists :=
		m.current[lease.MeetingID]

	if !exists {
		return false,
			nil
	}

	return current.Token ==
			lease.Token,
		nil
}

func (m *fakeLeaseManager) Release(
	_ context.Context,
	lease meetinglease.Lease,
) (
	bool,
	error,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	current, exists :=
		m.current[lease.MeetingID]

	if !exists {
		return false,
			nil
	}

	// Critical stale-owner protection.
	if current.Token !=
		lease.Token {

		return false,
			nil
	}

	delete(
		m.current,
		lease.MeetingID,
	)

	return true,
		nil
}

func (m *fakeLeaseManager) RenewalInterval() time.Duration {
	return m.interval
}

func (m *fakeLeaseManager) expire(
	meetingID string,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(
		m.current,
		meetingID,
	)
}

func (m *fakeLeaseManager) get(
	meetingID string,
) (
	meetinglease.Lease,
	bool,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	lease, exists :=
		m.current[meetingID]

	return lease,
		exists
}

func testLogger() *slog.Logger {
	return slog.New(
		slog.NewTextHandler(
			io.Discard,
			nil,
		),
	)
}

func waitSignal(
	t *testing.T,
	ch <-chan struct{},
	name string,
) {
	t.Helper()

	timer :=
		time.NewTimer(
			time.Second,
		)

	defer timer.Stop()

	select {
	case <-ch:

	case <-timer.C:
		t.Fatalf(
			"timed out waiting for %s",
			name,
		)
	}
}

func assertNotSignaled(
	t *testing.T,
	ch <-chan struct{},
	name string,
) {
	t.Helper()

	select {
	case <-ch:
		t.Fatalf(
			"%s unexpectedly happened",
			name,
		)

	default:
	}
}

func waitUntil(
	t *testing.T,
	name string,
	check func() bool,
) {
	t.Helper()

	deadline :=
		time.Now().
			Add(
				time.Second,
			)

	for time.Now().
		Before(
			deadline,
		) {

		if check() {
			return
		}

		time.Sleep(
			time.Millisecond,
		)
	}

	t.Fatalf(
		"timed out waiting for %s",
		name,
	)
}

func supervisorRunning(
	supervisor *Supervisor,
	meetingID string,
) bool {
	supervisor.mu.Lock()
	defer supervisor.mu.Unlock()

	_, exists :=
		supervisor.running[meetingID]

	return exists
}

func TestOnlyOneSupervisorOwnsMeeting(
	t *testing.T,
) {
	t.Parallel()

	leases :=
		newFakeLeaseManager()

	runtimeA :=
		newFakeRuntime()

	runtimeB :=
		newFakeRuntime()

	supervisorA, err :=
		New(
			runtimeA,
			leases,
			"instance-a",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	supervisorB, err :=
		New(
			runtimeB,
			leases,
			"instance-b",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx :=
		context.Background()

	active :=
		[]meetinglifecycle.ActiveMeeting{
			{
				MeetingID: "meeting-1",

				RoomName: "room-1",
			},
		}

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
		"instance B runtime start",
	)

	lease, exists :=
		leases.get(
			"meeting-1",
		)

	if !exists {
		t.Fatal(
			"expected active meeting lease",
		)
	}

	if lease.OwnerID !=
		"instance-a" {

		t.Fatalf(
			"expected instance-a ownership, got %q",
			lease.OwnerID,
		)
	}

	if lease.Fence != 1 {
		t.Fatalf(
			"expected first fence to be 1, got %d",
			lease.Fence,
		)
	}

	if runtimeA.lease.MeetingID !=
		lease.MeetingID {

		t.Fatalf(
			"expected runtime meeting ID %q, got %q",
			lease.MeetingID,
			runtimeA.lease.MeetingID,
		)
	}

	if runtimeA.lease.OwnerID !=
		lease.OwnerID {

		t.Fatalf(
			"expected runtime owner ID %q, got %q",
			lease.OwnerID,
			runtimeA.lease.OwnerID,
		)
	}

	if runtimeA.lease.Token !=
		lease.Token {

		t.Fatalf(
			"expected runtime lease token to match acquired lease",
		)
	}

	if runtimeA.lease.Fence !=
		lease.Fence {

		t.Fatalf(
			"expected runtime fence %d, got %d",
			lease.Fence,
			runtimeA.lease.Fence,
		)
	}

	if runtimeA.roomName !=
		"room-1" {

		t.Fatalf(
			"expected runtime room name %q, got %q",
			"room-1",
			runtimeA.roomName,
		)
	}

	supervisorA.stopMeeting(
		"meeting-1",
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
				"meeting-1",
			)
		},
	)
}

func TestReconcileTakesOverExpiredLease(
	t *testing.T,
) {
	t.Parallel()

	leases :=
		newFakeLeaseManager()

	runtimeA :=
		newFakeRuntime()

	runtimeB :=
		newFakeRuntime()

	supervisorA, err :=
		New(
			runtimeA,
			leases,
			"instance-a",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	supervisorB, err :=
		New(
			runtimeB,
			leases,
			"instance-b",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx :=
		context.Background()

	active :=
		[]meetinglifecycle.ActiveMeeting{
			{
				MeetingID: "meeting-1",

				RoomName: "room-1",
			},
		}

	// A wins initial ownership.
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

	// B sees the meeting as desired but cannot own it yet.
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
		"instance B runtime start before expiry",
	)

	supervisorB.mu.Lock()

	_, desired :=
		supervisorB.desired["meeting-1"]

	supervisorB.mu.Unlock()

	if !desired {
		t.Fatal(
			"instance B must retain denied meeting in desired state",
		)
	}

	// Simulate Redis TTL expiry caused by instance A crash.
	leases.expire(
		"meeting-1",
	)

	// Periodic reconciliation would call this automatically.
	supervisorB.reconcile(
		ctx,
	)

	waitSignal(
		t,
		runtimeB.started,
		"instance B takeover runtime start",
	)

	leaseB, exists :=
		leases.get(
			"meeting-1",
		)

	if !exists {
		t.Fatal(
			"expected takeover lease",
		)
	}

	if leaseB.OwnerID !=
		"instance-b" {

		t.Fatalf(
			"expected instance-b ownership, got %q",
			leaseB.OwnerID,
		)
	}

	if leaseB.Fence != 2 {
		t.Fatalf(
			"expected takeover fence 2, got %d",
			leaseB.Fence,
		)
	}

	// Now the old A runtime finally stops.
	//
	// Its stale token MUST NOT delete B's newer lease.
	supervisorA.stopMeeting(
		"meeting-1",
		"old owner cleanup",
	)

	waitSignal(
		t,
		runtimeA.stopped,
		"old instance runtime stop",
	)

	waitUntil(
		t,
		"old instance removal",
		func() bool {
			return !supervisorRunning(
				supervisorA,
				"meeting-1",
			)
		},
	)

	current, exists :=
		leases.get(
			"meeting-1",
		)

	if !exists {
		t.Fatal(
			"stale owner removed the new owner's lease",
		)
	}

	if current.Token !=
		leaseB.Token {

		t.Fatalf(
			"expected instance B lease token %q, got %q",
			leaseB.Token,
			current.Token,
		)
	}

	// Clean up B.
	supervisorB.stopMeeting(
		"meeting-1",
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
				"meeting-1",
			)
		},
	)

	if _, exists :=
		leases.get(
			"meeting-1",
		); exists {

		t.Fatal(
			"expected final lease release",
		)
	}
}

func TestReconcileDoesNotReacquireLocallyRunningMeeting(
	t *testing.T,
) {
	t.Parallel()

	leases :=
		newFakeLeaseManager()

	runtime :=
		newFakeRuntime()

	supervisor, err :=
		New(
			runtime,
			leases,
			"instance-a",
			testLogger(),
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx :=
		context.Background()

	active :=
		[]meetinglifecycle.ActiveMeeting{
			{
				MeetingID: "meeting-1",

				RoomName: "room-1",
			},
		}

	if err :=
		supervisor.Sync(
			ctx,
			active,
		); err != nil {

		t.Fatal(err)
	}

	waitSignal(
		t,
		runtime.started,
		"runtime start",
	)

	supervisor.reconcile(
		ctx,
	)

	supervisor.reconcile(
		ctx,
	)

	leases.mu.Lock()

	calls :=
		leases.acquireCalls["instance-a"]

	leases.mu.Unlock()

	if calls != 1 {
		t.Fatalf(
			"expected exactly one lease acquisition, got %d",
			calls,
		)
	}

	supervisor.stopMeeting(
		"meeting-1",
		"test cleanup",
	)

	waitSignal(
		t,
		runtime.stopped,
		"runtime stop",
	)

	waitUntil(
		t,
		"runtime removal",
		func() bool {
			return !supervisorRunning(
				supervisor,
				"meeting-1",
			)
		},
	)
}
