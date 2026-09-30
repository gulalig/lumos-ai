package intervention

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	media "github.com/livekit/media-sdk"
	"github.com/redis/go-redis/v9"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/speechfloor"
	"lumos/realtime-go/internal/tts"
)

type promptRetryFixture struct {
	ctx     context.Context
	client  *redisclient.Client
	raw     *redis.Client
	lease   meetinglease.Lease
	event   Event
	stream  string
	gap     string
	message redis.XMessage
}

func newPromptRetryFixture(t *testing.T) *promptRetryFixture {
	t.Helper()
	client, raw := interventionIntegrationRedisClients(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	meeting := fmt.Sprintf("prompt-retry-%d", time.Now().UnixNano())
	lease := meetinglease.Lease{MeetingID: meeting, OwnerID: "test", Token: "token", Fence: 1}
	event := validIntegrationEvent(meeting, "question")
	event.Reason = ReasonMissingDueDate
	stream := redisstream.InterventionStreamKey(meeting)
	gap := fmt.Sprintf("lumos:meeting:{%s}:intervention-gap:%s", meeting, event.GapID)
	cleanupInterventionKeys(t, raw, stream, gap, deliveryKey(meeting, event.ID),
		meetinglease.LeaseKey(meeting), meetinglease.FenceKey(meeting))
	seedInterventionLease(t, raw, ctx, lease)
	if err := client.XGroupCreateMkStream(ctx, stream, consumerGroup, "0"); err != nil {
		t.Fatal(err)
	}
	addInterventionEvent(t, client, ctx, stream, event)
	message := deliverInterventionToPending(t, client, ctx, stream, "test")
	return &promptRetryFixture{ctx, client, raw, lease, event, stream, gap, message}
}

func (f *promptRetryFixture) assertPending(t *testing.T, pending int64) {
	t.Helper()
	progress, err := f.client.XGroupProgress(f.ctx, f.stream, consumerGroup)
	if err != nil || progress.Pending != pending {
		t.Fatalf("pending=%d want=%d err=%v", progress.Pending, pending, err)
	}
	if pending != 0 {
		exists, err := f.raw.Exists(f.ctx, deliveryKey(f.event.MeetingID, f.event.ID)).Result()
		if err != nil || exists != 0 {
			t.Fatalf("undelivered intervention has delivery marker: exists=%d err=%v", exists, err)
		}
	}
}

func (f *promptRetryFixture) resolve(t *testing.T) {
	t.Helper()
	if err := f.raw.HSet(f.ctx, f.gap, "resolved_at_ms", time.Now().UnixMilli()).Err(); err != nil {
		t.Fatal(err)
	}
}

type promptRetryProvider struct {
	calls    atomic.Int32
	err      error
	prepared chan struct{}
}

func (p *promptRetryProvider) Synthesize(context.Context, string) (tts.Audio, error) {
	if p.calls.Add(1) == 1 && p.prepared != nil {
		close(p.prepared)
	}
	if p.err != nil {
		return tts.Audio{}, p.err
	}
	return tts.Audio{PCM: []byte{1, 0, 2, 0}, SampleRate: 22050, Channels: 1}, nil
}

type promptRetryPublisher struct {
	calls      atomic.Int32
	started    chan time.Time
	stopped    chan struct{}
	blockFirst bool
	err        error
	onPublish  func()
}

func (p *promptRetryPublisher) Publish(ctx context.Context, _ []media.PCM16Sample) error {
	attempt := p.calls.Add(1)
	if p.onPublish != nil {
		p.onPublish()
	}
	if p.err != nil {
		return p.err
	}
	p.started <- time.Now()
	if p.blockFirst && attempt == 1 {
		<-ctx.Done()
		close(p.stopped)
		return ctx.Err()
	}
	return nil
}

func newPromptRetryPublisher() *promptRetryPublisher {
	return &promptRetryPublisher{started: make(chan time.Time, 4), stopped: make(chan struct{})}
}

func startPromptDelivery(f *promptRetryFixture, speaker Speaker) <-chan error {
	consumer := NewConsumer(f.client, f.lease, "test", speaker, nil)
	done := make(chan error, 1)
	go func() { done <- consumer.process(f.ctx, f.stream, f.message) }()
	return done
}

func awaitPromptDone(t *testing.T, done <-chan error) {
	t.Helper()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("delivery entered delayed recovery instead of finishing promptly")
	}
}

func assertPromptPlayback(t *testing.T, publisher *promptRetryPublisher, stoppedAt time.Time) {
	t.Helper()
	select {
	case started := <-publisher.started:
		elapsed := started.Sub(stoppedAt)
		if elapsed < 450*time.Millisecond || elapsed >= 2*time.Second {
			t.Fatalf("quiet-to-playback=%v; want approximately 500ms, never 5s recovery", elapsed)
		}
		t.Logf("quiet-to-playback: %v", elapsed)
	case <-time.After(2 * time.Second):
		t.Fatal("same intervention did not speak promptly after the floor became quiet")
	}
}

// Reproduces the exact failure: participant activity revokes the granted floor
// during the pre-audio Redis validation, which returns wrapped context.Canceled.
// The SAME pending entry must retry without XAUTOCLAIM's five-second idle wait.
func TestFloorValidationCancellationRetriesPromptlyWithoutRecovery(t *testing.T) {
	for _, revoke := range []bool{false, true} {
		t.Run(fmt.Sprintf("grantRevoked=%v", revoke), func(t *testing.T) {
			f := newPromptRetryFixture(t)
			floor := speechfloor.New(speechfloor.QuietWindow)
			provider := &promptRetryProvider{}
			publisher := newPromptRetryPublisher()
			speaker, _ := NewTTSSpeaker(provider, publisher, nil)
			validating, proceed := make(chan struct{}), make(chan struct{})
			var validations atomic.Int32
			speaker.Coordinate(floor, func(ctx context.Context, event Event) error {
				if validations.Add(1) == 1 {
					close(validating)
					select {
					case <-proceed:
					case <-f.ctx.Done():
						return f.ctx.Err()
					}
					err := f.client.FencedCheck(ctx, meetinglease.LeaseKey(f.lease.MeetingID),
						meetinglease.FenceKey(f.lease.MeetingID), f.lease.Token, f.lease.Fence)
					if !errors.Is(err, context.Canceled) {
						return fmt.Errorf("Redis validation did not report cancellation: %v", err)
					}
					return err
				}
				if err := f.client.FencedCheck(ctx, meetinglease.LeaseKey(f.lease.MeetingID),
					meetinglease.FenceKey(f.lease.MeetingID), f.lease.Token, f.lease.Fence); err != nil {
					return err
				}
				return CheckCurrent(ctx, f.client, event)
			})
			done := startPromptDelivery(f, speaker)
			select {
			case <-validating:
			case <-f.ctx.Done():
				t.Fatal(f.ctx.Err())
			}
			if revoke {
				floor.Revoke()
			} else {
				floor.Activity("human")
			}
			close(proceed)
			f.assertPending(t, 1) // cancellation is not successful delivery
			floor.End("human")
			stoppedAt := time.Now()
			assertPromptPlayback(t, publisher, stoppedAt)
			awaitPromptDone(t, done)
			f.assertPending(t, 0)
			if validations.Load() != 2 || provider.calls.Load() != 1 || publisher.calls.Load() != 1 {
				t.Fatalf("validations=%d synthesis=%d playback=%d", validations.Load(), provider.calls.Load(), publisher.calls.Load())
			}
		})
	}
}

func TestParticipantResumingDuringQuietWindowResetsPromptSpeech(t *testing.T) {
	f := newPromptRetryFixture(t)
	floor := speechfloor.New(speechfloor.QuietWindow)
	provider := &promptRetryProvider{}
	publisher := newPromptRetryPublisher()
	speaker, _ := NewTTSSpeaker(provider, publisher, nil)
	speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, f.client, event) })
	done := startPromptDelivery(f, speaker)
	time.Sleep(200 * time.Millisecond)
	floor.Activity("human") // revokes the original quiet timer, before audio
	time.Sleep(200 * time.Millisecond)
	floor.End("human")
	stoppedAt := time.Now()
	f.assertPending(t, 1)
	assertPromptPlayback(t, publisher, stoppedAt)
	awaitPromptDone(t, done)
	f.assertPending(t, 0)
}

func TestAnswerResolvesInterventionWaitingOnQuietFloor(t *testing.T) {
	f := newPromptRetryFixture(t)
	floor := speechfloor.New(speechfloor.QuietWindow)
	floor.TryReserve("human", "answer")
	publisher := newPromptRetryPublisher()
	provider := &promptRetryProvider{prepared: make(chan struct{})}
	speaker, _ := NewTTSSpeaker(provider, publisher, nil)
	speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, f.client, event) })
	done := startPromptDelivery(f, speaker)
	select {
	case <-provider.prepared:
	case <-f.ctx.Done():
		t.Fatal(f.ctx.Err())
	}
	f.resolve(t)
	floor.Release("human", "answer")
	awaitPromptDone(t, done)
	f.assertPending(t, 0)
	if publisher.calls.Load() != 0 {
		t.Fatal("resolved question was spoken")
	}
}

func TestRuntimeShutdownDoesNotRetryOrAcknowledgeInterruptedSpeech(t *testing.T) {
	f := newPromptRetryFixture(t)
	floor := speechfloor.New(time.Millisecond)
	publisher := newPromptRetryPublisher()
	publisher.blockFirst = true
	provider := &promptRetryProvider{}
	speaker, _ := NewTTSSpeaker(provider, publisher, nil)
	speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, f.client, event) })
	consumer := NewConsumer(f.client, f.lease, "test", speaker, nil)
	ctx, cancel := context.WithCancel(f.ctx)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- consumer.process(ctx, f.stream, f.message) }()
	select {
	case <-publisher.started:
	case <-f.ctx.Done():
		t.Fatal(f.ctx.Err())
	}
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("shutdown error=%v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("runtime shutdown entered a speech retry loop")
	}
	f.assertPending(t, 1)
	if publisher.calls.Load() != 1 || provider.calls.Load() != 1 {
		t.Fatal("shutdown retried speech")
	}
}

func TestBargeInRetriesOnlyIfGapRemainsUnresolved(t *testing.T) {
	for _, resolved := range []bool{false, true} {
		t.Run(fmt.Sprintf("resolved=%v", resolved), func(t *testing.T) {
			f := newPromptRetryFixture(t)
			floor := speechfloor.New(speechfloor.QuietWindow)
			provider := &promptRetryProvider{}
			publisher := newPromptRetryPublisher()
			publisher.blockFirst = true
			speaker, _ := NewTTSSpeaker(provider, publisher, nil)
			speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, f.client, event) })
			done := startPromptDelivery(f, speaker)
			select {
			case <-publisher.started:
			case <-f.ctx.Done():
				t.Fatal(f.ctx.Err())
			}
			floor.PCM("human", []int16{2000, -2000})
			select {
			case <-publisher.stopped:
			case <-time.After(time.Second):
				t.Fatal("barge-in did not stop active playback")
			}
			f.assertPending(t, 1)
			if resolved {
				f.resolve(t)
			}
			floor.End("human")
			stoppedAt := time.Now()
			if !resolved {
				assertPromptPlayback(t, publisher, stoppedAt)
			}
			awaitPromptDone(t, done)
			f.assertPending(t, 0)
			want := int32(2)
			if resolved {
				want = 1
			}
			if publisher.calls.Load() != want || provider.calls.Load() != 1 {
				t.Fatalf("playbacks=%d want=%d synthesis=%d", publisher.calls.Load(), want, provider.calls.Load())
			}
		})
	}
}

func TestRealDeliveryFailuresRemainPendingForDurableRecovery(t *testing.T) {
	for _, kind := range []string{"synthesis", "network", "unrelated-context-canceled", "network-during-barge-in"} {
		t.Run(kind, func(t *testing.T) {
			f := newPromptRetryFixture(t)
			floor := speechfloor.New(time.Millisecond)
			provider := &promptRetryProvider{}
			publisher := newPromptRetryPublisher()
			failure := errors.New("delivery transport unavailable")
			switch kind {
			case "synthesis":
				provider.err = failure
			case "unrelated-context-canceled":
				failure = fmt.Errorf("upstream request: %w", context.Canceled)
				publisher.err = failure
			default:
				publisher.err = failure
			}
			if kind == "network-during-barge-in" {
				publisher.onPublish = func() { floor.Activity("human") }
			}
			speaker, _ := NewTTSSpeaker(provider, publisher, nil)
			speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, f.client, event) })
			consumer := NewConsumer(f.client, f.lease, "test", speaker, nil)
			err := consumer.process(f.ctx, f.stream, f.message)
			if !errors.Is(err, failure) || errors.Is(err, speechfloor.ErrInterrupted) {
				t.Fatalf("real failure misclassified: %v", err)
			}
			f.assertPending(t, 1)
			originalCalls := provider.calls.Load()
			if err := consumer.recoverPending(f.ctx, f.stream, pendingRetryMinIdle); err != nil {
				t.Fatal(err)
			}
			if provider.calls.Load() != originalCalls {
				t.Fatal("real failure incorrectly retried before durable recovery idle threshold")
			}
			// Age only this test entry's Redis PEL metadata instead of sleeping
			// five seconds. The actual XAUTOCLAIM recovery path must then work.
			if err := f.raw.Do(f.ctx, "XCLAIM", f.stream, consumerGroup, "test", 0,
				f.message.ID, "IDLE", pendingRetryMinIdle.Milliseconds()+1).Err(); err != nil {
				t.Fatal(err)
			}
			provider.err, publisher.err, publisher.onPublish = nil, nil, nil
			floor.End("human")
			if err := consumer.recoverPending(f.ctx, f.stream, pendingRetryMinIdle); err != nil {
				t.Fatal(err)
			}
			f.assertPending(t, 0)
			if provider.calls.Load() != originalCalls+1 {
				t.Fatal("durable recovery did not retry failed delivery")
			}
		})
	}
}
