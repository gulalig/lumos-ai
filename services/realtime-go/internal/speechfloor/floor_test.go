package speechfloor

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"
)

func TestFloorQuietWindowResetsAndParticipantBargesIn(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(time.Second)
		floor.Activity("human")
		acquired := make(chan context.Context, 1)
		var finish func()
		go func() {
			ctx, release, err := floor.Acquire(context.Background(), nil)
			if err != nil {
				t.Error(err)
				return
			}
			finish = release
			acquired <- ctx
		}()
		synctest.Wait()
		time.Sleep(800 * time.Millisecond)
		floor.Activity("other-human")
		time.Sleep(800 * time.Millisecond)
		synctest.Wait()
		select {
		case <-acquired:
			t.Fatal("spoke during reset quiet window")
		default:
		}
		time.Sleep(500 * time.Millisecond)
		synctest.Wait()
		ctx := <-acquired
		if floor.TryReserve("demo:maya", "wav") {
			t.Fatal("WAV granted while assistant owns floor")
		}
		floor.PCM("human", []int16{1200, -1200})
		if !errors.Is(context.Cause(ctx), ErrBargeIn) {
			t.Fatal("human speech did not cancel assistant")
		}
		finish()
		if !floor.TryReserve("demo:maya", "wav") {
			t.Fatal("WAV not granted after cancellation")
		}
		floor.Release("demo:maya", "wav")
	})
}

func TestReservationBlocksAssistantAndExpiresAfterDisconnect(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(time.Second)
		if !floor.TryReserve("demo:alex", "wav") {
			t.Fatal("no initial grant")
		}
		acquired := make(chan bool, 1)
		go func() {
			_, finish, err := floor.Acquire(context.Background(), nil)
			if err == nil {
				finish()
				acquired <- true
			}
		}()
		time.Sleep(2 * time.Second)
		synctest.Wait()
		select {
		case <-acquired:
			t.Fatal("assistant spoke over reserved participant")
		default:
		}
		floor.Disconnect("demo:alex")
		time.Sleep(900 * time.Millisecond)
		synctest.Wait()
		select {
		case <-acquired:
			t.Fatal("quiet window was skipped")
		default:
		}
		time.Sleep(200 * time.Millisecond)
		synctest.Wait()
		<-acquired
	})
}

func TestFloorChecksValidityAfterWaiting(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(time.Second)
		var resolved atomic.Bool
		expected := errors.New("resolved")
		done := make(chan error, 1)
		go func() {
			_, _, err := floor.Acquire(context.Background(), func(context.Context) error {
				if resolved.Load() {
					return expected
				}
				return nil
			})
			done <- err
		}()
		synctest.Wait()
		resolved.Store(true)
		time.Sleep(2 * time.Second)
		synctest.Wait()
		if !errors.Is(<-done, expected) {
			t.Fatal("stale question acquired floor")
		}
	})
}

func TestFloorHonorsSubMillisecondRemainingQuietWindow(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(time.Millisecond)
		time.Sleep(750 * time.Microsecond)
		done := make(chan error, 1)
		go func() {
			_, finish, err := floor.Acquire(context.Background(), nil)
			if err == nil {
				finish()
				finish() // release is idempotent
			}
			done <- err
		}()
		time.Sleep(500 * time.Microsecond)
		synctest.Wait()
		select {
		case err := <-done:
			if err != nil {
				t.Fatal(err)
			}
		default:
			t.Fatal("a fractional quiet window turned into a long wait")
		}
	})
}

func TestDefaultFloorWaitsExactly500msAfterLastParticipantPCM(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(0)
		done := make(chan time.Time, 1)
		go func() {
			_, finish, err := floor.Acquire(context.Background(), nil)
			if err != nil {
				t.Error(err)
				return
			}
			finish()
			done <- time.Now()
		}()
		time.Sleep(300 * time.Millisecond)
		floor.PCM("human", []int16{2000, -2000})
		lastSpeech := time.Now()
		time.Sleep(499 * time.Millisecond)
		synctest.Wait()
		select {
		case <-done:
			t.Fatal("old quiet timer survived participant speech")
		default:
		}
		time.Sleep(time.Millisecond)
		synctest.Wait()
		if delay := (<-done).Sub(lastSpeech); delay != 500*time.Millisecond {
			t.Fatalf("quiet window=%v; want 500ms with no extra voice hold", delay)
		}
	})
}

func TestFloorReturnsCoordinationCauseWhenRedisValidationIsCanceled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floor := New(0)
		_, _, err := floor.Acquire(context.Background(), func(ctx context.Context) error {
			floor.Activity("human")
			return fmt.Errorf("redis eval: %w", ctx.Err())
		})
		if !errors.Is(err, ErrBargeIn) || !errors.Is(err, ErrInterrupted) {
			t.Fatalf("floor cause lost behind Redis cancellation: %v", err)
		}
		floor.End("human")
		stoppedAt := time.Now()
		_, finish, err := floor.Acquire(context.Background(), nil)
		if err != nil {
			t.Fatal(err)
		}
		defer finish()
		if delay := time.Since(stoppedAt); delay != 500*time.Millisecond {
			t.Fatalf("retry delay=%v; want 500ms", delay)
		}
	})
}

func TestCancellationClassificationDoesNotHideRealFailures(t *testing.T) {
	for _, cause := range []error{ErrBargeIn, ErrRevoked, context.Canceled} {
		ctx, cancel := context.WithCancelCause(context.Background())
		cancel(cause)
		operationCanceled := fmt.Errorf("redis eval: %w", context.Canceled)
		classified := CancellationError(ctx, operationCanceled)
		if errors.Is(classified, ErrInterrupted) != errors.Is(cause, ErrInterrupted) {
			t.Fatalf("incorrect cancellation classification: cause=%v classified=%v", cause, classified)
		}
		networkError := errors.New("connection reset")
		if got := CancellationError(ctx, networkError); got != networkError {
			t.Fatalf("real network error hidden by concurrent floor activity: %v", got)
		}
	}
}
