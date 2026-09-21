package evidence

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"lumos/realtime-go/internal/observability"
)

const (
	defaultQueueSize = 128
	publishTimeout   = 3 * time.Second
)

var (
	ErrDispatcherClosed = errors.New(
		"evidence dispatcher is closed",
	)

	ErrDispatcherFailed = errors.New(
		"evidence dispatcher failed",
	)
)

type Publisher interface {
	Publish(
		ctx context.Context,
		turn Turn,
	) (string, error)
}

type Dispatcher struct {
	publisher Publisher
	logger    *slog.Logger

	metrics *observability.Metrics

	queue chan Turn

	mu     sync.RWMutex
	closed bool

	failed atomic.Bool

	failureSignal chan struct{}
	failureErr    chan error

	failOnce sync.Once

	wg sync.WaitGroup
}

func NewDispatcher(
	publisher Publisher,
	logger *slog.Logger,
	metrics ...*observability.Metrics,
) *Dispatcher {
	var metricsRecorder *observability.Metrics

	if len(metrics) > 0 {
		metricsRecorder =
			metrics[0]
	}

	dispatcher :=
		&Dispatcher{
			publisher: publisher,

			logger: logger,

			metrics: metricsRecorder,

			queue: make(
				chan Turn,
				defaultQueueSize,
			),

			failureSignal: make(
				chan struct{},
			),

			failureErr: make(
				chan error,
				1,
			),
		}

	dispatcher.wg.Add(
		1,
	)

	go dispatcher.run()

	return dispatcher
}

func (
	d *Dispatcher,
) Errors() <-chan error {
	return d.failureErr
}

func (
	d *Dispatcher,
) Enqueue(
	ctx context.Context,
	turn Turn,
) error {
	if d.failed.Load() {
		return ErrDispatcherFailed
	}

	if err :=
		ValidateTurnResourceLimits(
			turn,
		); err != nil {

		failureErr :=
			fmt.Errorf(
				"evidence turn rejected by resource limits: eventId=%q meetingId=%q: %w",
				turn.EventID,
				turn.MeetingID,
				err,
			)

		d.fail(
			failureErr,
		)

		return fmt.Errorf(
			"%w: %w",
			ErrDispatcherFailed,
			failureErr,
		)
	}

	d.mu.RLock()

	if d.closed {
		d.mu.RUnlock()

		return ErrDispatcherClosed
	}

	// Fast path.
	//
	// If the queue can accept immediately, this enqueue did not
	// experience backpressure.
	select {
	case d.queue <- turn:
		if d.metrics != nil {
			d.metrics.AddEvidenceQueueDepth(
				1,
			)
		}

		d.mu.RUnlock()

		return nil

	default:
	}

	if d.metrics != nil {
		d.metrics.
			IncEvidenceQueueBackpressure()
	}

	select {
	case d.queue <- turn:
		if d.metrics != nil {
			d.metrics.AddEvidenceQueueDepth(
				1,
			)
		}

		d.mu.RUnlock()

		return nil

	case <-d.failureSignal:
		d.mu.RUnlock()

		return ErrDispatcherFailed

	case <-ctx.Done():
		d.mu.RUnlock()

		return ctx.Err()
	}
}

func (
	d *Dispatcher,
) Close() {
	d.mu.Lock()

	if d.closed {
		d.mu.Unlock()

		d.wg.Wait()

		if d.metrics != nil {
			remaining :=
				len(
					d.queue,
				)

			if remaining > 0 {
				d.metrics.AddEvidenceQueueDepth(
					-remaining,
				)
			}
		}

		return
	}

	d.closed = true

	close(
		d.queue,
	)

	d.mu.Unlock()

	d.wg.Wait()
}

func (d *Dispatcher) run() {
	defer d.wg.Done()

	for turn := range d.queue {

		if d.metrics != nil {
			d.metrics.AddEvidenceQueueDepth(
				-1,
			)
		}

		if err :=
			d.publish(
				turn,
			); err != nil {

			d.fail(
				err,
			)

			return
		}
	}
}

func (
	d *Dispatcher,
) fail(
	err error,
) {
	if err == nil {
		return
	}

	d.failOnce.Do(
		func() {
			// Set the state before waking blocked producers.
			d.failed.Store(
				true,
			)

			d.logger.Error(
				"evidence dispatcher entered terminal failure",

				"error",
				err,
			)

			d.failureErr <- err

			close(
				d.failureSignal,
			)
		},
	)
}

func (
	d *Dispatcher,
) publish(
	turn Turn,
) error {
	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			publishTimeout,
		)

	defer cancel()

	streamID, err :=
		d.publisher.Publish(
			ctx,
			turn,
		)

	if err != nil {
		return fmt.Errorf(
			"publish evidence turn %q for meeting %q: %w",
			turn.EventID,
			turn.MeetingID,
			err,
		)
	}

	d.logger.Info(
		"evidence turn published",

		"eventId",
		turn.EventID,

		"meetingId",
		turn.MeetingID,

		"participantId",
		turn.ParticipantID,

		"turnOrder",
		turn.TurnOrder,

		"streamId",
		streamID,
	)

	return nil
}
