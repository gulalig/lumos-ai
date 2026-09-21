package evidence

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type highVolumeEvidencePublisher struct {
	started chan struct{}
	release chan struct{}

	startOnce sync.Once

	published atomic.Int64

	mu   sync.Mutex
	seen map[string]int
}

func (
	p *highVolumeEvidencePublisher,
) Publish(
	ctx context.Context,
	turn Turn,
) (
	string,
	error,
) {
	p.startOnce.Do(
		func() {
			close(
				p.started,
			)
		},
	)

	// The first publish is deliberately held so concurrent
	// producers can saturate the bounded dispatcher queue.
	//
	// Once release is closed, this and every later publish
	// proceed immediately.
	select {
	case <-p.release:

	case <-ctx.Done():
		return "",
			ctx.Err()
	}

	p.mu.Lock()

	p.seen[turn.EventID]++

	p.mu.Unlock()

	p.published.Add(
		1,
	)

	return fmt.Sprintf(
			"stream-%s",
			turn.EventID,
		),
		nil
}

func TestDispatcherPreservesAllEvidenceUnderConcurrentPressure(
	t *testing.T,
) {
	const (
		producerCount    = 16
		turnsPerProducer = 64

		concurrentTurnCount = producerCount *
			turnsPerProducer
	)

	publisher :=
		&highVolumeEvidencePublisher{
			started: make(
				chan struct{},
			),

			release: make(
				chan struct{},
			),

			seen: make(
				map[string]int,
				concurrentTurnCount+1,
			),
		}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	dispatcher :=
		NewDispatcher(
			publisher,
			logger,
		)

	// Cleanup must also unblock the fake publisher if the
	// test exits early before the normal release point.
	t.Cleanup(
		func() {
			select {
			case <-publisher.release:

			default:
				close(
					publisher.release,
				)
			}

			dispatcher.Close()
		},
	)

	capturedAt :=
		time.Now().
			UTC()

	// Occupy the single dispatcher worker first.
	//
	// This makes the following concurrent burst deterministic:
	// the worker cannot drain while producers fill the queue.
	primer :=
		highVolumeTurn(
			"pressure-primer",
			0,
			0,
			capturedAt,
		)

	if err :=
		dispatcher.Enqueue(
			context.Background(),
			primer,
		); err != nil {

		t.Fatalf(
			"enqueue pressure primer: %v",
			err,
		)
	}

	select {
	case <-publisher.started:

	case <-time.After(
		2 * time.Second,
	):
		t.Fatal(
			"publisher did not start",
		)
	}

	var producerWG sync.WaitGroup

	producerErrors :=
		make(
			chan error,
			producerCount,
		)

	for producer :=
		0; producer <
		producerCount; producer++ {

		producer :=
			producer

		producerWG.Add(
			1,
		)

		go func() {
			defer producerWG.Done()

			for offset :=
				0; offset <
				turnsPerProducer; offset++ {

				index :=
					producer*
						turnsPerProducer +
						offset

				turn :=
					highVolumeTurn(
						fmt.Sprintf(
							"pressure-%04d",
							index,
						),
						producer,
						index+1,
						capturedAt,
					)

				if err :=
					dispatcher.Enqueue(
						context.Background(),
						turn,
					); err != nil {

					producerErrors <- fmt.Errorf(
						"producer %d enqueue %d: %w",
						producer,
						offset,
						err,
					)

					return
				}
			}
		}()
	}

	// Because the worker is still blocked on the primer,
	// concurrent producers must eventually fill the complete
	// bounded queue.
	queueDeadline :=
		time.Now().
			Add(
				2 * time.Second,
			)

	for len(
		dispatcher.queue,
	) <
		defaultQueueSize &&
		time.Now().
			Before(
				queueDeadline,
			) {

		time.Sleep(
			time.Millisecond,
		)
	}

	if depth :=
		len(
			dispatcher.queue,
		); depth !=
		defaultQueueSize {

		t.Fatalf(
			"expected queue pressure to reach capacity %d, got %d",
			defaultQueueSize,
			depth,
		)
	}

	// Restore downstream capacity.
	close(
		publisher.release,
	)

	producersDone :=
		make(
			chan struct{},
		)

	go func() {
		producerWG.Wait()

		close(
			producersDone,
		)
	}()

	select {
	case <-producersDone:

	case <-time.After(
		10 * time.Second,
	):
		t.Fatal(
			"concurrent evidence producers did not finish",
		)
	}

	close(
		producerErrors,
	)

	for err := range producerErrors {

		if err != nil {
			t.Fatal(err)
		}
	}

	// Every producer has finished enqueueing.
	//
	// Close must synchronously drain every accepted turn
	// before it returns.
	dispatcher.Close()

	expectedPublished :=
		int64(
			concurrentTurnCount + 1,
		)

	actualPublished :=
		publisher.published.Load()

	if actualPublished !=
		expectedPublished {

		t.Fatalf(
			"expected %d published evidence turns, got %d",
			expectedPublished,
			actualPublished,
		)
	}

	publisher.mu.Lock()
	defer publisher.mu.Unlock()

	if len(
		publisher.seen,
	) !=
		int(
			expectedPublished,
		) {

		t.Fatalf(
			"expected %d unique published event IDs, got %d",
			expectedPublished,
			len(
				publisher.seen,
			),
		)
	}

	for eventID, count := range publisher.seen {

		if count != 1 {
			t.Fatalf(
				"event %q was published %d times; expected exactly once",
				eventID,
				count,
			)
		}
	}
}

func highVolumeTurn(
	eventID string,
	producer int,
	order int,
	capturedAt time.Time,
) Turn {
	return Turn{
		SchemaVersion: SchemaVersion,

		EventID: eventID,

		MeetingID: "meeting-high-volume",

		ParticipantID: fmt.Sprintf(
			"participant-%02d",
			producer,
		),

		TrackID: fmt.Sprintf(
			"track-%02d",
			producer,
		),

		TurnOrder: order,

		Text: fmt.Sprintf(
			"High volume evidence turn %d from producer %d.",
			order,
			producer,
		),

		CapturedAt: capturedAt.Add(
			time.Duration(
				order,
			) * time.Millisecond,
		),
	}
}
