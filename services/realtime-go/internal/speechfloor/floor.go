// Package speechfloor coordinates live room audio independently of transcription
// latency. The lease-owning runtime arbitrates participant and assistant turns.
package speechfloor

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

const QuietWindow = 500 * time.Millisecond
const ReservationTTL = 3 * time.Second
const voiceHold = 150 * time.Millisecond

var (
	ErrInterrupted = errors.New("speech floor interrupted")
	ErrBargeIn     = fmt.Errorf("participant interrupted assistant speech: %w", ErrInterrupted)
	ErrRevoked     = fmt.Errorf("speech floor grant revoked: %w", ErrInterrupted)
)

// CancellationError preserves the typed floor cause when a canceled operation
// (including Redis validation) reports only context.Canceled. Genuine transport
// failures and parent shutdown are not classified as coordination retries.
func CancellationError(ctx context.Context, err error) error {
	if errors.Is(err, context.Canceled) && errors.Is(context.Cause(ctx), ErrInterrupted) {
		return context.Cause(ctx)
	}
	return err
}

type reservation struct {
	request string
	until   time.Time
}

type Floor struct {
	mu           sync.Mutex
	quiet        time.Duration
	lastHuman    time.Time
	voices       map[string]time.Time
	reservations map[string]reservation
	changed      chan struct{}
	speechCancel context.CancelCauseFunc
}

func New(quiet time.Duration) *Floor {
	if quiet <= 0 {
		quiet = QuietWindow
	}
	return &Floor{quiet: quiet, lastHuman: time.Now(), voices: map[string]time.Time{},
		reservations: map[string]reservation{}, changed: make(chan struct{})}
}

func (f *Floor) notify() { close(f.changed); f.changed = make(chan struct{}) }

// PCM observes decoded audio before the transcription network round trip.
// An energy threshold excludes silence, with a short hold for intra-word gaps.
func (f *Floor) PCM(track string, samples []int16) {
	if len(samples) == 0 {
		return
	}
	var energy int64
	for _, sample := range samples {
		value := int64(sample)
		energy += value * value
	}
	if energy/int64(len(samples)) < 180*180 {
		return
	}
	f.Activity(track)
}

func (f *Floor) Activity(track string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	now := time.Now()
	f.lastHuman = now
	f.voices[track] = now.Add(voiceHold)
	if f.speechCancel != nil {
		f.speechCancel(ErrBargeIn)
	}
	f.notify()
}

func (f *Floor) End(track string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.voices[track]; exists {
		delete(f.voices, track)
		f.lastHuman = time.Now()
		f.notify()
	}
}

// Revoke cancels an outstanding local speech grant. This is floor coordination,
// not loss of the durable meeting lease (which must stop the runtime).
func (f *Floor) Revoke() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastHuman = time.Now()
	if f.speechCancel != nil {
		f.speechCancel(ErrRevoked)
	}
	f.notify()
}

// TryReserve is an atomic handshake for clients that can coordinate playback.
// A grant prevents assistant acquisition until release or heartbeat expiry.
// Real people can always barge in; they are observed through PCM/ASR activity.
func (f *Floor) TryReserve(participant, request string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	now := time.Now()
	if f.speechCancel != nil {
		return false
	}
	for identity, reservation := range f.reservations {
		if now.Before(reservation.until) && (identity != participant || reservation.request != request) {
			return false
		}
	}
	f.reservations[participant] = reservation{request: request, until: now.Add(ReservationTTL)}
	f.lastHuman = now
	f.notify()
	return true
}

func (f *Floor) Release(participant, request string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if reservation, exists := f.reservations[participant]; exists && reservation.request == request {
		delete(f.reservations, participant)
		f.lastHuman = time.Now()
		f.notify()
	}
}

func (f *Floor) Disconnect(participant string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.reservations[participant]; exists {
		delete(f.reservations, participant)
		f.lastHuman = time.Now()
		f.notify()
	}
}

// Acquire waits for an uninterrupted quiet window and atomically claims the
// floor. Rechecking validity after the wait prevents stale queued questions.
func (f *Floor) Acquire(ctx context.Context, valid func(context.Context) error) (context.Context, func(), error) {
	for {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		f.mu.Lock()
		now := time.Now()
		readyAt := f.lastHuman.Add(f.quiet)
		for _, until := range f.voices {
			// The short voice hold is inside, not in addition to, the
			// quiet window measured from the last decoded speech.
			if until.After(readyAt) {
				readyAt = until
			}
		}
		for _, reservation := range f.reservations {
			if reservation.until.Add(f.quiet).After(readyAt) {
				readyAt = reservation.until.Add(f.quiet)
			}
		}
		changed := f.changed
		delay := readyAt.Sub(now)
		if delay <= 0 && f.speechCancel == nil {
			speechCtx, cancel := context.WithCancelCause(ctx)
			f.speechCancel = cancel
			f.mu.Unlock()
			var once sync.Once
			finish := func() {
				once.Do(func() {
					f.mu.Lock()
					defer f.mu.Unlock()
					cancel(nil)
					f.speechCancel = nil
					f.notify()
				})
			}
			if valid != nil {
				if err := valid(speechCtx); err != nil {
					err = CancellationError(speechCtx, err)
					finish()
					return nil, nil, err
				}
			}
			if err := context.Cause(speechCtx); err != nil {
				finish()
				return nil, nil, err
			}
			return speechCtx, finish, nil
		}
		assistantBusy := f.speechCancel != nil
		f.mu.Unlock()
		if assistantBusy {
			select {
			case <-ctx.Done():
				return nil, nil, ctx.Err()
			case <-changed:
			}
			continue
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, nil, ctx.Err()
		case <-changed:
			timer.Stop()
		case <-timer.C:
		}
	}
}
