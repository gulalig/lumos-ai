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

type blockingEvidencePublisher struct {
	started chan struct{}
	release chan struct{}

	startOnce sync.Once

	published atomic.Int64
}

func (
	p *blockingEvidencePublisher,
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

	select {
	case <-p.release:
		p.published.Add(
			1,
		)

		return fmt.Sprintf(
				"stream-%s",
				turn.EventID,
			),
			nil

	case <-ctx.Done():
		return "",
			ctx.Err()
	}
}

func TestDispatcherAppliesBackpressureWhenQueueIsFull(
	t *testing.T,
) {
	publisher :=
		&blockingEvidencePublisher{
			started: make(
				chan struct{},
			),

			release: make(
				chan struct{},
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

	t.Cleanup(
		dispatcher.Close,
	)

	newTurn :=
		func(
			index int,
		) Turn {
			return Turn{
				SchemaVersion: SchemaVersion,

				EventID: fmt.Sprintf(
					"evidence-%d",
					index,
				),

				MeetingID: "meeting-backpressure",

				ParticipantID: "participant-1",

				TrackID: "track-1",

				TurnOrder: index,

				Text: fmt.Sprintf(
					"Evidence turn %d",
					index,
				),

				CapturedAt: time.Now().
					UTC(),
			}
		}

	// ---------------------------------------------------------
	// First turn is consumed by the dispatcher worker.
	//
	// The fake publisher then blocks, so the worker can no
	// longer drain the queue.
	// ---------------------------------------------------------

	if err :=
		dispatcher.Enqueue(
			context.Background(),
			newTurn(
				0,
			),
		); err != nil {

		t.Fatalf(
			"enqueue first turn: %v",
			err,
		)
	}

	select {
	case <-publisher.started:

	case <-time.After(
		time.Second,
	):
		t.Fatal(
			"publisher did not start",
		)
	}

	// ---------------------------------------------------------
	// Fill the entire bounded queue.
	// ---------------------------------------------------------

	for index := 1; index <=
		defaultQueueSize; index++ {

		if err :=
			dispatcher.Enqueue(
				context.Background(),
				newTurn(
					index,
				),
			); err != nil {

			t.Fatalf(
				"fill queue at index %d: %v",
				index,
				err,
			)
		}
	}

	// ---------------------------------------------------------
	// One more turn must NOT be accepted immediately.
	//
	// It must wait for capacity or caller cancellation.
	// ---------------------------------------------------------

	blockedCtx, cancel :=
		context.WithCancel(
			context.Background(),
		)

	blockedResult :=
		make(
			chan error,
			1,
		)

	go func() {
		blockedResult <- dispatcher.Enqueue(
			blockedCtx,
			newTurn(
				defaultQueueSize+1,
			),
		)
	}()

	select {
	case err :=
		<-blockedResult:

		t.Fatalf(
			"enqueue unexpectedly completed while queue was full: %v",
			err,
		)

	case <-time.After(
		100 * time.Millisecond,
	):
		// Expected:
		// producer is backpressured.
	}

	// ---------------------------------------------------------
	// Cancelling the producer context releases the blocked
	// enqueue instead of silently dropping the event.
	// ---------------------------------------------------------

	cancel()

	select {
	case err :=
		<-blockedResult:

		if err !=
			context.Canceled {

			t.Fatalf(
				"expected context.Canceled, got %v",
				err,
			)
		}

	case <-time.After(
		time.Second,
	):
		t.Fatal(
			"blocked enqueue did not unblock after cancellation",
		)
	}

	// ---------------------------------------------------------
	// Restore downstream capacity.
	// ---------------------------------------------------------

	close(
		publisher.release,
	)

	// Close synchronously drains every turn that was actually
	// accepted by the dispatcher.
	dispatcher.Close()

	expectedPublished :=
		int64(
			defaultQueueSize + 1,
		)

	actualPublished :=
		publisher.published.Load()

	if actualPublished !=
		expectedPublished {

		t.Fatalf(
			"expected %d accepted turns to publish, got %d",
			expectedPublished,
			actualPublished,
		)
	}
}
