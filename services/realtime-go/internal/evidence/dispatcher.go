package evidence

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"
)

const (
	defaultQueueSize = 128
	publishTimeout   = 3 * time.Second
)

var ErrDispatcherClosed = errors.New(
	"evidence dispatcher is closed",
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

	queue chan Turn

	mu     sync.RWMutex
	closed bool

	wg sync.WaitGroup
}

func NewDispatcher(
	publisher Publisher,
	logger *slog.Logger,
) *Dispatcher {
	dispatcher := &Dispatcher{
		publisher: publisher,
		logger:    logger,
		queue:     make(chan Turn, defaultQueueSize),
	}

	dispatcher.wg.Add(1)

	go dispatcher.run()

	return dispatcher
}

func (d *Dispatcher) Enqueue(
	ctx context.Context,
	turn Turn,
) error {
	d.mu.RLock()

	if d.closed {
		d.mu.RUnlock()
		return ErrDispatcherClosed
	}

	select {
	case d.queue <- turn:
		d.mu.RUnlock()
		return nil

	case <-ctx.Done():
		d.mu.RUnlock()
		return ctx.Err()
	}
}

func (d *Dispatcher) Close() {
	d.mu.Lock()

	if d.closed {
		d.mu.Unlock()
		return
	}

	d.closed = true
	close(d.queue)

	d.mu.Unlock()

	d.wg.Wait()
}

func (d *Dispatcher) run() {
	defer d.wg.Done()

	for turn := range d.queue {
		d.publish(turn)
	}
}

func (d *Dispatcher) publish(
	turn Turn,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		publishTimeout,
	)
	defer cancel()

	streamID, err := d.publisher.Publish(
		ctx,
		turn,
	)
	if err != nil {
		d.logger.Error(
			"failed to publish evidence turn",
			"eventId", turn.EventID,
			"meetingId", turn.MeetingID,
			"error", err,
		)

		return
	}

	d.logger.Info(
		"evidence turn published",
		"eventId", turn.EventID,
		"meetingId", turn.MeetingID,
		"participantId", turn.ParticipantID,
		"turnOrder", turn.TurnOrder,
		"streamId", streamID,
	)
}
