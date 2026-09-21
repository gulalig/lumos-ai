package meetingsupervisor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/meetinglifecycle"
	"lumos/realtime-go/internal/observability"
)

const (
	supervisorShutdownTimeout = 10 * time.Second
	leaseReleaseTimeout       = 3 * time.Second
	reconcileInterval         = 3 * time.Second
)

type RuntimeRunner interface {
	Run(
		ctx context.Context,
		lease meetinglease.Lease,
		roomName string,
	) error
}

type LeaseManager interface {
	Acquire(
		ctx context.Context,
		meetingID string,
		ownerID string,
	) (
		meetinglease.Lease,
		bool,
		error,
	)

	Renew(
		ctx context.Context,
		lease meetinglease.Lease,
	) (
		bool,
		error,
	)

	Release(
		ctx context.Context,
		lease meetinglease.Lease,
	) (
		bool,
		error,
	)

	RenewalInterval() time.Duration
}

type runningMeeting struct {
	meetingID string
	roomName  string

	lease meetinglease.Lease

	runtimeCancel context.CancelCauseFunc
	leaseCancel   context.CancelFunc

	stopping bool
}

type Supervisor struct {
	runtime RuntimeRunner

	leases LeaseManager
	keeper *meetinglease.Keeper

	instanceID string

	logger *slog.Logger

	metrics *observability.Metrics

	runtimeSlots chan struct{}

	mu sync.Mutex

	desired map[string]meetinglifecycle.ActiveMeeting
	running map[string]*runningMeeting

	takeoverWaitingSince map[string]time.Time

	wg sync.WaitGroup

	runtimeErr chan error
}

func New(
	runtime RuntimeRunner,
	leases LeaseManager,
	instanceID string,
	logger *slog.Logger,
	metrics ...*observability.Metrics,
) (*Supervisor, error) {
	if runtime == nil {
		return nil,
			fmt.Errorf(
				"meeting runtime runner is required",
			)
	}

	if leases == nil {
		return nil,
			fmt.Errorf(
				"meeting lease manager is required",
			)
	}

	instanceID =
		strings.TrimSpace(
			instanceID,
		)

	if instanceID == "" {
		return nil,
			fmt.Errorf(
				"realtime instance ID is required",
			)
	}

	if logger == nil {
		logger =
			slog.Default()
	}

	keeper, err :=
		meetinglease.NewKeeper(
			leases,
			leases.RenewalInterval(),
		)

	if err != nil {
		return nil,
			fmt.Errorf(
				"create meeting lease keeper: %w",
				err,
			)
	}

	var metricsRecorder *observability.Metrics

	if len(metrics) > 0 {
		metricsRecorder =
			metrics[0]
	}

	return &Supervisor{
			runtime: runtime,

			leases: leases,

			keeper: keeper,

			instanceID: instanceID,

			logger: logger,

			metrics: metricsRecorder,

			takeoverWaitingSince: make(
				map[string]time.Time,
			),

			runtimeSlots: make(
				chan struct{},
				maxConcurrentMeetingRuntimes,
			),

			desired: make(
				map[string]meetinglifecycle.ActiveMeeting,
			),

			running: make(
				map[string]*runningMeeting,
			),

			runtimeErr: make(
				chan error,
				1,
			),
		},
		nil
}

func (s *Supervisor) Run(
	ctx context.Context,
	consumer *meetinglifecycle.Consumer,
) error {
	if consumer == nil {
		return fmt.Errorf(
			"meeting lifecycle consumer is required",
		)
	}

	runCtx, cancel :=
		context.WithCancel(
			ctx,
		)

	defer cancel()

	consumerErr :=
		make(
			chan error,
			1,
		)

	var consumerWG sync.WaitGroup

	consumerWG.Go(func() {
		consumerErr <- consumer.Run(
			runCtx,
			s,
		)
	})

	var reconcileWG sync.WaitGroup

	reconcileWG.Go(func() {
		s.runReconciler(
			runCtx,
		)
	})

	s.logger.Info(
		"meeting supervisor started",
		"instanceId",
		s.instanceID,
	)

	var result error

	select {
	case <-ctx.Done():

	case err := <-consumerErr:
		if err != nil {
			result =
				fmt.Errorf(
					"meeting lifecycle consumer: %w",
					err,
				)
		} else if ctx.Err() == nil {
			result =
				fmt.Errorf(
					"meeting lifecycle consumer stopped unexpectedly",
				)
		}

	case err := <-s.runtimeErr:
		result = err
	}

	cancel()

	s.stopAll()

	waitGroup(
		&s.wg,
		supervisorShutdownTimeout,
		s.logger,
		"meeting runtimes",
	)

	waitGroup(
		&consumerWG,
		supervisorShutdownTimeout,
		s.logger,
		"meeting lifecycle consumer",
	)

	waitGroup(
		&reconcileWG,
		supervisorShutdownTimeout,
		s.logger,
		"meeting ownership reconciler",
	)

	s.logger.Info(
		"meeting supervisor stopped",
		"instanceId",
		s.instanceID,
	)

	return result
}

func (s *Supervisor) Sync(
	ctx context.Context,
	meetings []meetinglifecycle.ActiveMeeting,
) error {
	desired :=
		make(
			map[string]meetinglifecycle.ActiveMeeting,
			len(meetings),
		)

	for _, meeting := range meetings {

		meetingID :=
			strings.TrimSpace(
				meeting.MeetingID,
			)

		roomName :=
			strings.TrimSpace(
				meeting.RoomName,
			)

		if meetingID == "" {
			return fmt.Errorf(
				"active meeting ID is empty",
			)
		}

		if roomName == "" {
			return fmt.Errorf(
				"active meeting %s room name is empty",
				meetingID,
			)
		}

		desired[meetingID] =
			meetinglifecycle.ActiveMeeting{
				MeetingID: meetingID,

				RoomName: roomName,
			}
	}

	s.mu.Lock()

	s.desired =
		desired

	// A takeover wait is meaningful only while the meeting
	// remains part of desired durable lifecycle state.
	for meetingID := range s.takeoverWaitingSince {

		if _, exists :=
			desired[meetingID]; exists {

			continue
		}

		delete(
			s.takeoverWaitingSince,
			meetingID,
		)
	}

	currentIDs :=
		make(
			[]string,
			0,
			len(s.running),
		)

	for meetingID := range s.running {

		currentIDs =
			append(
				currentIDs,
				meetingID,
			)
	}

	s.mu.Unlock()

	// Stop runtimes that are no longer active
	// according to durable lifecycle state.
	for _, meetingID := range currentIDs {

		if _, exists :=
			desired[meetingID]; exists {

			continue
		}

		s.stopMeeting(
			meetingID,
			"lifecycle replay reconciliation",
		)
	}

	// Try immediately.
	//
	// If another instance owns a meeting,
	// startMeeting safely returns without starting
	// anything. The periodic reconciler will retry.
	for _, meeting := range meetings {

		if err :=
			s.startMeeting(
				ctx,
				meeting.MeetingID,
				meeting.RoomName,
			); err != nil {

			return err
		}
	}

	return nil
}

func (s *Supervisor) Handle(
	ctx context.Context,
	event meetinglifecycle.Event,
) error {
	switch event.Type {
	case meetinglifecycle.EventTypeStarted:
		meeting :=
			meetinglifecycle.ActiveMeeting{
				MeetingID: strings.TrimSpace(
					event.MeetingID,
				),

				RoomName: strings.TrimSpace(
					event.RoomName,
				),
			}

		if meeting.MeetingID == "" {
			return fmt.Errorf(
				"started meeting ID is empty",
			)
		}

		if meeting.RoomName == "" {
			return fmt.Errorf(
				"started meeting %s room name is empty",
				meeting.MeetingID,
			)
		}

		s.mu.Lock()

		s.desired[meeting.MeetingID] =
			meeting

		s.mu.Unlock()

		return s.startMeeting(
			ctx,
			meeting.MeetingID,
			meeting.RoomName,
		)

	case meetinglifecycle.EventTypeEnded:
		meetingID :=
			strings.TrimSpace(
				event.MeetingID,
			)

		s.mu.Lock()

		delete(
			s.desired,
			meetingID,
		)

		delete(
			s.takeoverWaitingSince,
			meetingID,
		)

		s.mu.Unlock()

		s.stopMeeting(
			meetingID,
			"meeting ended",
		)

		return nil

	default:
		return nil
	}
}

func (s *Supervisor) startMeeting(
	parent context.Context,
	meetingID string,
	roomName string,
) error {
	meetingID =
		strings.TrimSpace(
			meetingID,
		)

	roomName =
		strings.TrimSpace(
			roomName,
		)

	if meetingID == "" {
		return fmt.Errorf(
			"meeting ID is required",
		)
	}

	if roomName == "" {
		return fmt.Errorf(
			"room name is required for meeting %s",
			meetingID,
		)
	}

	// -------------------------------------------------------------
	// Local duplicate protection
	// -------------------------------------------------------------

	s.mu.Lock()

	if current, exists :=
		s.running[meetingID]; exists {

		if current.roomName !=
			roomName {

			s.mu.Unlock()

			return fmt.Errorf(
				"meeting %s room changed from %q to %q",
				meetingID,
				current.roomName,
				roomName,
			)
		}

		s.mu.Unlock()

		s.logger.Debug(
			"meeting runtime already active locally",
			"meetingId",
			meetingID,
			"roomName",
			roomName,
			"instanceId",
			s.instanceID,
		)

		return nil
	}

	s.mu.Unlock()

	// -------------------------------------------------------------
	// Local instance capacity
	// -------------------------------------------------------------
	//
	// Reserve capacity BEFORE acquiring the distributed lease.
	//
	// A saturated instance must not acquire and hold ownership
	// for a meeting it cannot actually run. Desired state remains
	// intact, so the periodic reconciler can retry later.
	if !s.tryReserveRuntimeSlot() {
		if s.metrics != nil {
			s.metrics.IncCapacityDeferral()
		}

		s.logger.Warn(
			"meeting runtime deferred because local instance capacity was reached",
			"meetingId",
			meetingID,
			"roomName",
			roomName,
			"instanceId",
			s.instanceID,
			"maxConcurrentMeetings",
			maxConcurrentMeetingRuntimes,
		)

		return nil
	}

	// Unless ownership is successfully transferred to
	// runOwnedMeeting below, every early return must give the
	// reservation back.
	releaseReservedSlot := true

	defer func() {
		if releaseReservedSlot {
			s.releaseRuntimeSlot()
		}
	}()

	// -------------------------------------------------------------
	// Distributed ownership
	// -------------------------------------------------------------

	lease, acquired, err :=
		s.leases.Acquire(
			parent,
			meetingID,
			s.instanceID,
		)

	if err != nil {
		return fmt.Errorf(
			"acquire runtime lease for meeting %s: %w",
			meetingID,
			err,
		)
	}

	if !acquired {
		s.mu.Lock()

		// Remember only the first observation.
		//
		// Reconciliation can hit this branch repeatedly while the
		// current owner's lease is still alive. Resetting the timestamp
		// on every attempt would measure only the final retry interval
		// instead of the whole locally-observed handoff delay.
		if _, running :=
			s.running[meetingID]; !running {

			if _, waiting :=
				s.takeoverWaitingSince[meetingID]; !waiting {

				s.takeoverWaitingSince[meetingID] = time.Now()
			}
		}

		s.mu.Unlock()

		s.logger.Info(
			"meeting runtime owned by another instance",
			"meetingId",
			meetingID,
			"roomName",
			roomName,
			"instanceId",
			s.instanceID,
		)

		return nil
	}

	// Runtime cancellation follows meeting lifecycle.
	runtimeCtx, runtimeCancel :=
		context.WithCancelCause(
			parent,
		)

	// Lease renewal intentionally does NOT use runtimeCtx.
	//
	// Runtime shutdown may spend time flushing media,
	// evidence and semantic processing. We must keep
	// ownership during that drain period.
	leaseCtx, leaseCancel :=
		context.WithCancel(
			context.Background(),
		)

	entry :=
		&runningMeeting{
			meetingID: meetingID,

			roomName: roomName,

			lease: lease,

			runtimeCancel: runtimeCancel,

			leaseCancel: leaseCancel,
		}

	s.mu.Lock()

	// Defensive second local check.
	//
	// Redis ownership prevents distributed duplication,
	// but keep the local registry internally consistent.
	if current, exists :=
		s.running[meetingID]; exists {

		s.mu.Unlock()

		runtimeCancel(nil)
		leaseCancel()

		s.releaseLease(
			lease,
			"duplicate local start",
		)

		if current.roomName !=
			roomName {

			return fmt.Errorf(
				"meeting %s room changed from %q to %q",
				meetingID,
				current.roomName,
				roomName,
			)
		}

		return nil
	}

	s.running[meetingID] =
		entry

	if s.metrics != nil {
		s.metrics.SetActiveMeetings(
			len(
				s.running,
			),
		)
	}

	takeoverStartedAt, takeoverObserved :=
		s.takeoverWaitingSince[meetingID]

	if takeoverObserved {
		delete(
			s.takeoverWaitingSince,
			meetingID,
		)
	}

	s.mu.Unlock()

	if takeoverObserved &&
		s.metrics != nil {

		s.metrics.ObserveLeaseTakeover(
			time.Since(
				takeoverStartedAt,
			),
		)
	}

	s.logger.Info(
		"meeting runtime lease acquired",
		"meetingId",
		meetingID,
		"roomName",
		roomName,
		"instanceId",
		s.instanceID,
		"fence",
		lease.Fence,
	)

	s.logger.Info(
		"starting meeting runtime",
		"meetingId",
		meetingID,
		"roomName",
		roomName,
		"instanceId",
		s.instanceID,
		"fence",
		lease.Fence,
	)

	releaseReservedSlot =
		false

	s.wg.Go(func() {
		s.runOwnedMeeting(
			entry,
			runtimeCtx,
			leaseCtx,
		)
	})

	return nil
}

func (s *Supervisor) runOwnedMeeting(
	entry *runningMeeting,
	runtimeCtx context.Context,
	leaseCtx context.Context,
) {
	defer s.releaseRuntimeSlot()

	keeperDone :=
		make(
			chan error,
			1,
		)

	go func() {
		err :=
			s.keeper.Run(
				leaseCtx,
				entry.lease,
			)

		if err != nil {
			s.logger.Error(
				"meeting runtime lease keeper failed",
				"meetingId",
				entry.meetingID,
				"roomName",
				entry.roomName,
				"instanceId",
				s.instanceID,
				"fence",
				entry.lease.Fence,
				"error",
				err,
			)

			// Fail closed.
			//
			// If Redis cannot confirm ownership,
			// this instance must immediately stop
			// producing new meeting work.
			entry.runtimeCancel(err)
		}

		keeperDone <- err
	}()

	runtimeErr :=
		s.runtime.Run(
			runtimeCtx,
			entry.lease,
			entry.roomName,
		)

	// Runtime has now fully completed its shutdown,
	// including its durable evidence drain.
	//
	// Only now may ownership renewal stop.
	entry.leaseCancel()

	keeperErr :=
		<-keeperDone

	// Release after the runtime is fully stopped.
	//
	// Token comparison inside Redis prevents a stale
	// runtime from deleting a newer owner's lease.
	s.releaseLease(
		entry.lease,
		"runtime exited",
	)

	s.handleRuntimeExit(
		entry,
		runtimeErr,
		keeperErr,
		runtimeCtx,
	)
}

func (s *Supervisor) stopMeeting(
	meetingID string,
	reason string,
) {
	s.mu.Lock()

	entry, exists :=
		s.running[meetingID]

	if !exists {
		s.mu.Unlock()

		s.logger.Debug(
			"meeting runtime is not active locally",
			"meetingId",
			meetingID,
			"instanceId",
			s.instanceID,
			"reason",
			reason,
		)

		return
	}

	if entry.stopping {
		s.mu.Unlock()

		return
	}

	entry.stopping = true

	s.mu.Unlock()

	s.logger.Info(
		"stopping meeting runtime",
		"meetingId",
		meetingID,
		"roomName",
		entry.roomName,
		"instanceId",
		s.instanceID,
		"fence",
		entry.lease.Fence,
		"reason",
		reason,
	)

	// Do NOT cancel the lease keeper here.
	//
	// Runtime.Run may still be draining durable work.
	// runOwnedMeeting will cancel lease renewal only
	// after Runtime.Run returns.
	entry.runtimeCancel(nil)
}

func (s *Supervisor) stopAll() {
	s.mu.Lock()

	entries :=
		make(
			[]*runningMeeting,
			0,
			len(s.running),
		)

	for _, entry := range s.running {

		if entry.stopping {
			continue
		}

		entry.stopping = true

		entries =
			append(
				entries,
				entry,
			)
	}

	s.mu.Unlock()

	for _, entry := range entries {

		entry.runtimeCancel(nil)
	}
}

func (s *Supervisor) runReconciler(
	ctx context.Context,
) {
	ticker :=
		time.NewTicker(
			reconcileInterval,
		)

	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			s.reconcile(
				ctx,
			)
		}
	}
}

func (s *Supervisor) reconcile(
	ctx context.Context,
) {
	s.mu.Lock()

	desired :=
		make(
			[]meetinglifecycle.ActiveMeeting,
			0,
			len(s.desired),
		)

	for _, meeting := range s.desired {

		desired =
			append(
				desired,
				meeting,
			)
	}

	s.mu.Unlock()

	for _, meeting := range desired {

		if ctx.Err() != nil {
			return
		}

		if err :=
			s.startMeeting(
				ctx,
				meeting.MeetingID,
				meeting.RoomName,
			); err != nil {

			s.logger.Error(
				"failed to reconcile meeting ownership",
				"meetingId",
				meeting.MeetingID,
				"roomName",
				meeting.RoomName,
				"instanceId",
				s.instanceID,
				"error",
				err,
			)
		}
	}
}

func (s *Supervisor) handleRuntimeExit(
	entry *runningMeeting,
	runtimeErr error,
	keeperErr error,
	runtimeCtx context.Context,
) {
	s.mu.Lock()

	current, exists :=
		s.running[entry.meetingID]

	if exists &&
		current == entry {

		delete(
			s.running,
			entry.meetingID,
		)

		if s.metrics != nil {
			s.metrics.SetActiveMeetings(
				len(
					s.running,
				),
			)
		}
	}

	expectedStop :=
		entry.stopping ||
			runtimeCtx.Err() != nil

	s.mu.Unlock()

	// One runtime exit may report the same ownership-loss event
	// through both:
	//
	// 1. the lease keeper, and
	// 2. a fenced Redis mutation inside the runtime.
	//
	// Count the logical ownership loss exactly once here.
	leaseLost :=
		errors.Is(
			keeperErr,
			meetinglease.ErrLeaseLost,
		) ||
			errors.Is(
				runtimeErr,
				meetinglease.ErrLeaseLost,
			)

	if leaseLost &&
		s.metrics != nil {

		s.metrics.IncLeaseLoss()

		s.metrics.IncFailure(
			"meeting_runtime",
			"lease_lost",
		)
	}

	// Lease failure always wins over the normal
	// context-cancel interpretation.
	//
	// The keeper itself cancelled runtimeCtx when
	// ownership became uncertain/lost.
	if keeperErr != nil {
		err :=
			fmt.Errorf(
				"meeting %s runtime lease failed: %w",
				entry.meetingID,
				keeperErr,
			)

		s.logger.Error(
			"meeting runtime ownership lost",
			"meetingId",
			entry.meetingID,
			"roomName",
			entry.roomName,
			"instanceId",
			s.instanceID,
			"fence",
			entry.lease.Fence,
			"error",
			keeperErr,
		)

		select {
		case s.runtimeErr <- err:
		default:
		}

		return
	}

	if expectedStop {
		s.logger.Info(
			"meeting runtime exited",
			"meetingId",
			entry.meetingID,
			"roomName",
			entry.roomName,
			"instanceId",
			s.instanceID,
			"fence",
			entry.lease.Fence,
		)

		return
	}

	if runtimeErr == nil {
		runtimeErr =
			fmt.Errorf(
				"meeting runtime stopped unexpectedly",
			)
	}

	err :=
		fmt.Errorf(
			"meeting %s runtime failed: %w",
			entry.meetingID,
			runtimeErr,
		)

	s.logger.Error(
		"meeting runtime failed",
		"meetingId",
		entry.meetingID,
		"roomName",
		entry.roomName,
		"instanceId",
		s.instanceID,
		"fence",
		entry.lease.Fence,
		"error",
		runtimeErr,
	)

	select {
	case s.runtimeErr <- err:
	default:
	}
}

func (s *Supervisor) releaseLease(
	lease meetinglease.Lease,
	reason string,
) {
	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			leaseReleaseTimeout,
		)

	defer cancel()

	released, err :=
		s.leases.Release(
			ctx,
			lease,
		)

	if err != nil {
		s.logger.Warn(
			"failed to release meeting runtime lease",
			"meetingId",
			lease.MeetingID,
			"instanceId",
			s.instanceID,
			"fence",
			lease.Fence,
			"reason",
			reason,
			"error",
			err,
		)

		return
	}

	if !released {
		s.logger.Debug(
			"meeting runtime lease was already lost or replaced",
			"meetingId",
			lease.MeetingID,
			"instanceId",
			s.instanceID,
			"fence",
			lease.Fence,
			"reason",
			reason,
		)

		return
	}

	s.logger.Info(
		"meeting runtime lease released",
		"meetingId",
		lease.MeetingID,
		"instanceId",
		s.instanceID,
		"fence",
		lease.Fence,
		"reason",
		reason,
	)
}

func waitGroup(
	wg *sync.WaitGroup,
	timeout time.Duration,
	logger *slog.Logger,
	name string,
) {
	done :=
		make(
			chan struct{},
		)

	go func() {
		wg.Wait()
		close(done)
	}()

	timer :=
		time.NewTimer(
			timeout,
		)

	defer timer.Stop()

	select {
	case <-done:

	case <-timer.C:
		logger.Warn(
			"timed out waiting for component shutdown",
			"component",
			name,
		)
	}
}
