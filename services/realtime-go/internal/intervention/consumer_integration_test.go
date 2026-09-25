package intervention

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

type countingSpeaker struct {
	mu    sync.Mutex
	calls int
}

func (s *countingSpeaker) Speak(
	_ context.Context,
	_ Event,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.calls++

	return nil
}

func (s *countingSpeaker) Calls() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.calls
}

func TestConsumerSkipsSpeechWhenDeliveryMarkerAlreadyExists(
	t *testing.T,
) {
	client, rawClient :=
		interventionIntegrationRedisClients(
			t,
		)

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"intervention-delivered-%d",
			time.Now().UnixNano(),
		)

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "instance-a",
			Token:     "token-a",
			Fence:     1,
		}

	stream :=
		redisstream.InterventionStreamKey(
			meetingID,
		)

	delivery :=
		deliveryKey(
			meetingID,
			"event-1",
		)

	cleanupInterventionKeys(
		t,
		rawClient,
		meetinglease.LeaseKey(
			meetingID,
		),
		meetinglease.FenceKey(
			meetingID,
		),
		stream,
		delivery,
	)

	seedInterventionLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			stream,
			consumerGroup,
			"0",
		); err != nil {

		t.Fatal(err)
	}

	event :=
		validIntegrationEvent(
			meetingID,
			"event-1",
		)

	messageID :=
		addInterventionEvent(
			t,
			client,
			ctx,
			stream,
			event,
		)

	pending :=
		deliverInterventionToPending(
			t,
			client,
			ctx,
			stream,
			"seed-consumer",
		)

	if pending.ID !=
		messageID {

		t.Fatalf(
			"expected pending message %q, got %q",
			messageID,
			pending.ID,
		)
	}

	if err :=
		rawClient.Set(
			ctx,
			delivery,
			deliveryStateDelivered,
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}

	speaker :=
		&countingSpeaker{}

	consumer :=
		NewConsumer(
			client,
			lease,
			"recovery-consumer",
			speaker,
			nil,
		)

	if err :=
		consumer.recoverPending(
			ctx,
			stream,
			0,
		); err != nil {

		t.Fatal(err)
	}

	if calls :=
		speaker.Calls(); calls != 0 {

		t.Fatalf(
			"expected delivered intervention not to speak again, calls=%d",
			calls,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected recovered delivered intervention to be ACKed, pending=%d",
			progress.Pending,
		)
	}
}

func TestConsumerDoesNotSpeakWhenLeaseIsStale(
	t *testing.T,
) {
	client, rawClient :=
		interventionIntegrationRedisClients(
			t,
		)

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"intervention-stale-%d",
			time.Now().UnixNano(),
		)

	staleLease :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "instance-a",
			Token:     "token-a",
			Fence:     1,
		}

	stream :=
		redisstream.InterventionStreamKey(
			meetingID,
		)

	delivery :=
		deliveryKey(
			meetingID,
			"event-1",
		)

	cleanupInterventionKeys(
		t,
		rawClient,
		meetinglease.LeaseKey(
			meetingID,
		),
		meetinglease.FenceKey(
			meetingID,
		),
		stream,
		delivery,
	)

	// Current owner is B.
	if err :=
		rawClient.Set(
			ctx,
			meetinglease.LeaseKey(
				meetingID,
			),
			"token-b",
			30*time.Second,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		rawClient.Set(
			ctx,
			meetinglease.FenceKey(
				meetingID,
			),
			"2",
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			stream,
			consumerGroup,
			"0",
		); err != nil {

		t.Fatal(err)
	}

	event :=
		validIntegrationEvent(
			meetingID,
			"event-1",
		)

	addInterventionEvent(
		t,
		client,
		ctx,
		stream,
		event,
	)

	deliverInterventionToPending(
		t,
		client,
		ctx,
		stream,
		"seed-consumer",
	)

	speaker :=
		&countingSpeaker{}

	consumer :=
		NewConsumer(
			client,
			staleLease,
			"stale-consumer",
			speaker,
			nil,
		)

	if err :=
		consumer.recoverPending(
			ctx,
			stream,
			0,
		); err != nil {

		t.Fatal(err)
	}

	if calls :=
		speaker.Calls(); calls != 0 {

		t.Fatalf(
			"stale intervention consumer must not speak, calls=%d",
			calls,
		)
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progress.Pending != 1 {
		t.Fatalf(
			"stale consumer must leave event pending, pending=%d",
			progress.Pending,
		)
	}

	exists, err :=
		rawClient.Exists(
			ctx,
			delivery,
		).Result()

	if err != nil {
		t.Fatal(err)
	}

	if exists != 0 {
		t.Fatal(
			"stale consumer must not persist delivered marker",
		)
	}
}

func TestConsumerRecoveryDoesNotRepeatSpeechAfterDeliveredMarker(
	t *testing.T,
) {
	client, rawClient :=
		interventionIntegrationRedisClients(
			t,
		)

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"intervention-recovery-%d",
			time.Now().UnixNano(),
		)

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,
			OwnerID:   "instance-a",
			Token:     "token-a",
			Fence:     1,
		}

	stream :=
		redisstream.InterventionStreamKey(
			meetingID,
		)

	delivery :=
		deliveryKey(
			meetingID,
			"event-1",
		)

	cleanupInterventionKeys(
		t,
		rawClient,
		meetinglease.LeaseKey(
			meetingID,
		),
		meetinglease.FenceKey(
			meetingID,
		),
		stream,
		delivery,
	)

	seedInterventionLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			stream,
			consumerGroup,
			"0",
		); err != nil {

		t.Fatal(err)
	}

	event :=
		validIntegrationEvent(
			meetingID,
			"event-1",
		)

	addInterventionEvent(
		t,
		client,
		ctx,
		stream,
		event,
	)

	message :=
		deliverInterventionToPending(
			t,
			client,
			ctx,
			stream,
			"seed-consumer",
		)

	speaker :=
		&countingSpeaker{}

	consumer :=
		NewConsumer(
			client,
			lease,
			"consumer-a",
			speaker,
			nil,
		)

	// Simulate:
	//
	//   Speak succeeded
	//   ↓
	//   durable delivered marker succeeded
	//   ↓
	//   process died before ACK
	if err :=
		consumer.redis.FencedCheck(
			ctx,
			meetinglease.LeaseKey(
				meetingID,
			),
			meetinglease.FenceKey(
				meetingID,
			),
			lease.Token,
			lease.Fence,
		); err != nil {

		t.Fatal(err)
	}

	if err :=
		speaker.Speak(
			ctx,
			event,
		); err != nil {

		t.Fatal(err)
	}

	if err :=
		consumer.redis.FencedSet(
			ctx,
			meetinglease.LeaseKey(
				meetingID,
			),
			meetinglease.FenceKey(
				meetingID,
			),
			lease.Token,
			lease.Fence,
			delivery,
			deliveryStateDelivered,
		); err != nil {

		t.Fatal(err)
	}

	if calls :=
		speaker.Calls(); calls != 1 {

		t.Fatalf(
			"expected exactly one initial speech, calls=%d",
			calls,
		)
	}

	progressBefore, err :=
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progressBefore.Pending != 1 {
		t.Fatalf(
			"expected event to remain pending before recovery, pending=%d",
			progressBefore.Pending,
		)
	}

	recoveryConsumer :=
		NewConsumer(
			client,
			lease,
			"consumer-b",
			speaker,
			nil,
		)

	if err :=
		recoveryConsumer.recoverPending(
			ctx,
			stream,
			0,
		); err != nil {

		t.Fatal(err)
	}

	if calls :=
		speaker.Calls(); calls != 1 {

		t.Fatalf(
			"recovery repeated already delivered speech, calls=%d",
			calls,
		)
	}

	progressAfter, err :=
		client.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		t.Fatal(err)
	}

	if progressAfter.Pending != 0 {
		t.Fatalf(
			"expected recovery to ACK delivered intervention, pending=%d",
			progressAfter.Pending,
		)
	}

	_ = message
}

func interventionIntegrationRedisClients(
	t *testing.T,
) (
	*redisclient.Client,
	*redis.Client,
) {
	t.Helper()

	redisURL :=
		strings.TrimSpace(
			os.Getenv(
				"REDIS_URL",
			),
		)

	if redisURL == "" {
		t.Skip(
			"REDIS_URL is not configured",
		)
	}

	client, err :=
		redisclient.New(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"create redis client: %v",
			err,
		)
	}

	t.Cleanup(
		func() {
			_ = client.Close()
		},
	)

	options, err :=
		redis.ParseURL(
			redisURL,
		)

	if err != nil {
		t.Fatalf(
			"parse Redis URL: %v",
			err,
		)
	}

	rawClient :=
		redis.NewClient(
			options,
		)

	t.Cleanup(
		func() {
			_ = rawClient.Close()
		},
	)

	if err :=
		rawClient.Ping(
			context.Background(),
		).Err(); err != nil {

		t.Fatalf(
			"ping Redis: %v",
			err,
		)
	}

	return client,
		rawClient
}

func seedInterventionLease(
	t *testing.T,
	rawClient *redis.Client,
	ctx context.Context,
	lease meetinglease.Lease,
) {
	t.Helper()

	if err :=
		rawClient.Set(
			ctx,
			meetinglease.LeaseKey(
				lease.MeetingID,
			),
			lease.Token,
			30*time.Second,
		).Err(); err != nil {

		t.Fatal(err)
	}

	if err :=
		rawClient.Set(
			ctx,
			meetinglease.FenceKey(
				lease.MeetingID,
			),
			fmt.Sprintf(
				"%d",
				lease.Fence,
			),
			0,
		).Err(); err != nil {

		t.Fatal(err)
	}
}

func validIntegrationEvent(
	meetingID string,
	eventID string,
) Event {
	return Event{
		ID: eventID,

		GapID: "gap-1",

		MeetingID: meetingID,

		SprintItemID: "item-1",

		ObservationID: "observation-1",

		Reason: ReasonMissingOwner,

		Message: "Who's taking this one?",

		CreatedAt: time.Now().UTC(),
	}
}

func addInterventionEvent(
	t *testing.T,
	client *redisclient.Client,
	ctx context.Context,
	stream string,
	event Event,
) string {
	t.Helper()

	payload, err :=
		json.Marshal(
			event,
		)

	if err != nil {
		t.Fatal(err)
	}

	id, err :=
		client.XAdd(
			ctx,
			stream,
			map[string]any{
				"event_type": EventType,
				"event_id":   event.ID,
				"payload":    string(payload),
			},
		)

	if err != nil {
		t.Fatal(err)
	}

	return id
}

func deliverInterventionToPending(
	t *testing.T,
	client *redisclient.Client,
	ctx context.Context,
	stream string,
	consumer string,
) redis.XMessage {
	t.Helper()

	streams, err :=
		client.XReadGroup(
			ctx,
			consumerGroup,
			consumer,
			stream,
			1,
			100*time.Millisecond,
		)

	if err != nil {
		t.Fatal(err)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatalf(
			"expected one intervention message, got %#v",
			streams,
		)
	}

	return streams[0].Messages[0]
}

func cleanupInterventionKeys(
	t *testing.T,
	rawClient *redis.Client,
	keys ...string,
) {
	t.Helper()

	t.Cleanup(
		func() {
			ctx, cancel :=
				context.WithTimeout(
					context.Background(),
					3*time.Second,
				)

			defer cancel()

			_ =
				rawClient.Del(
					ctx,
					keys...,
				).Err()
		},
	)
}
