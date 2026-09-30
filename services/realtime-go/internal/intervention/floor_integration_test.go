package intervention

import (
	"context"
	"errors"
	"fmt"
	media "github.com/livekit/media-sdk"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/speechfloor"
	"lumos/realtime-go/internal/tts"
	"testing"
	"time"
)

type notifiedTTSProvider struct{ synthesized chan struct{} }

func (p *notifiedTTSProvider) Synthesize(context.Context, string) (tts.Audio, error) {
	close(p.synthesized)
	return tts.Audio{PCM: []byte{1, 0, 2, 0}, SampleRate: 22050, Channels: 1}, nil
}

func TestResolvedQueuedInterventionNeverSpeaksAfterQuietWait(t *testing.T) {
	client, raw := interventionIntegrationRedisClients(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	meeting := fmt.Sprintf("floor-stale-%d", time.Now().UnixNano())
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
	floor := speechfloor.New(5 * time.Millisecond)
	floor.TryReserve("human", "wav")
	provider := &notifiedTTSProvider{synthesized: make(chan struct{})}
	publisher := &fakePCMPublisher{}
	speaker, _ := NewTTSSpeaker(provider, publisher, nil)
	speaker.Coordinate(floor, func(ctx context.Context, event Event) error { return CheckCurrent(ctx, client, event) })
	consumer := NewConsumer(client, lease, "test", speaker, nil)
	done := make(chan error, 1)
	go func() { done <- consumer.process(ctx, stream, message) }()
	select {
	case <-provider.synthesized:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	// Resolution occurs after synthesis while speech is waiting for the floor.
	if err := raw.HSet(ctx, gap, "resolved_at_ms", time.Now().UnixMilli()).Err(); err != nil {
		t.Fatal(err)
	}
	floor.Release("human", "wav")
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if len(publisher.frames) != 0 {
		t.Fatal("resolved question was spoken")
	}
	progress, err := client.XGroupProgress(ctx, stream, consumerGroup)
	if err != nil || progress.Pending != 0 {
		t.Fatalf("stale event not acknowledged: %+v %v", progress, err)
	}
	// Recovery and duplicate processing cannot speak it later.
	addInterventionEvent(t, client, ctx, stream, event)
	message = deliverInterventionToPending(t, client, ctx, stream, "test")
	if err := consumer.process(ctx, stream, message); err != nil {
		t.Fatal(err)
	}
	if len(publisher.frames) != 0 {
		t.Fatal("stale event spoken on recovery")
	}
}

type cancellablePCMPublisher struct{ started chan struct{} }

func (p *cancellablePCMPublisher) Publish(ctx context.Context, _ []media.PCM16Sample) error {
	close(p.started)
	<-ctx.Done()
	return ctx.Err()
}

func TestTTSSpeakerStopsOnHumanBargeIn(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	floor := speechfloor.New(time.Millisecond)
	publisher := &cancellablePCMPublisher{started: make(chan struct{})}
	speaker, _ := NewTTSSpeaker(&notifiedTTSProvider{synthesized: make(chan struct{})}, publisher, nil)
	speaker.Coordinate(floor, nil)
	done := make(chan error, 1)
	go func() { done <- speaker.Speak(ctx, validTTSEvent()) }()
	select {
	case <-publisher.started:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	floor.PCM("human", []int16{2000, -2000})
	if err := <-done; !errors.Is(err, speechfloor.ErrBargeIn) {
		t.Fatalf("speech not interrupted: %v", err)
	}
}
