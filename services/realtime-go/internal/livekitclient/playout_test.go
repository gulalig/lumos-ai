package livekitclient

import (
	"context"
	"errors"
	"testing"
	"time"
)

type queuedTestTrack struct {
	done    chan struct{}
	cleared bool
	waiting chan struct{}
}

func (q *queuedTestTrack) WaitForPlayout() {
	if q.waiting != nil {
		close(q.waiting)
	}
	<-q.done
}
func (q *queuedTestTrack) ClearQueue() { q.cleared = true; close(q.done) }

func TestCancelledPlayoutDiscardsQueuedAudio(t *testing.T) {
	track := &queuedTestTrack{done: make(chan struct{})}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := waitForPlayout(ctx, track); !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
	if !track.cleared {
		t.Fatal("queued audio kept playing")
	}
}

func TestActivePlayoutCancellationClearsQueueAndStopsWaiter(t *testing.T) {
	track := &queuedTestTrack{done: make(chan struct{}), waiting: make(chan struct{})}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- waitForPlayout(ctx, track) }()
	select {
	case <-track.waiting:
	case <-time.After(time.Second):
		t.Fatal("playout waiter did not start")
	}
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) || !track.cleared {
			t.Fatalf("active audio was not cleared on cancellation: err=%v cleared=%v", err, track.cleared)
		}
	case <-time.After(time.Second):
		t.Fatal("active audio kept playing or its waiter leaked after cancellation")
	}
}
