package intervention

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/speechfloor"
)

const (
	consumerGroup = "realtime-intervention"

	readBatchSize = 16

	readBlockTime = 2 * time.Second

	pendingRetryMinIdle = 5 * time.Second
)

type Consumer struct {
	redis *redisclient.Client

	lease meetinglease.Lease

	consumerName string

	speaker Speaker

	logger *slog.Logger
}

func NewConsumer(
	redisClient *redisclient.Client,
	lease meetinglease.Lease,
	consumerName string,
	speaker Speaker,
	logger *slog.Logger,
) *Consumer {
	if logger == nil {
		logger = slog.Default()
	}

	return &Consumer{
		redis: redisClient,

		lease: lease,

		consumerName: consumerName,

		speaker: speaker,

		logger: logger,
	}
}

func (c *Consumer) Run(
	ctx context.Context,
) error {
	if c.redis == nil {
		return fmt.Errorf(
			"intervention consumer Redis client is required",
		)
	}

	if c.lease.MeetingID == "" {
		return fmt.Errorf(
			"intervention consumer meeting ID is required",
		)
	}

	if c.lease.Token == "" {
		return fmt.Errorf(
			"intervention consumer lease token is required",
		)
	}

	if c.lease.Fence <= 0 {
		return fmt.Errorf(
			"intervention consumer lease fence must be positive",
		)
	}

	if c.consumerName == "" {
		return fmt.Errorf(
			"intervention consumer name is required",
		)
	}

	if c.speaker == nil {
		return fmt.Errorf(
			"intervention consumer speaker is required",
		)
	}

	stream :=
		redisstream.InterventionStreamKey(
			c.lease.MeetingID,
		)

	// "$" is intentional.
	//
	// When the group is created for the first time,
	// historical intervention events are skipped.
	//
	// Existing groups retain durable progress and
	// pending entries are recovered below.
	if err := c.redis.XGroupCreateMkStream(
		ctx,
		stream,
		consumerGroup,
		"$",
	); err != nil {
		return fmt.Errorf(
			"create intervention consumer group: %w",
			err,
		)
	}

	// Recover pending work immediately on startup.
	//
	// This runtime already owns the meeting lease, so work
	// left pending by the previous runtime can be claimed
	// immediately.
	if err := c.recoverPending(
		ctx,
		stream,
		0,
	); err != nil {
		if ctx.Err() != nil {
			return nil
		}

		return err
	}

	c.logger.Info(
		"intervention consumer started",
		"meetingId",
		c.lease.MeetingID,
		"consumer",
		c.consumerName,
		"stream",
		stream,
		"fence",
		c.lease.Fence,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		if err := c.recoverPending(
			ctx,
			stream,
			pendingRetryMinIdle,
		); err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return err
		}

		streams, err :=
			c.redis.XReadGroup(
				ctx,
				consumerGroup,
				c.consumerName,
				stream,
				readBatchSize,
				readBlockTime,
			)

		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf(
				"read intervention stream: %w",
				err,
			)
		}

		for _, result := range streams {

			for _, message := range result.Messages {

				if err := c.process(
					ctx,
					stream,
					message,
				); err != nil {

					c.logger.Error(
						"failed to process intervention",
						"meetingId",
						c.lease.MeetingID,
						"streamId",
						message.ID,
						"error",
						err,
					)

					// Intentionally do NOT ACK.
					//
					// The event stays in the PEL and can
					// be retried or recovered later.
					continue
				}
			}
		}
	}
}

func (c *Consumer) process(
	ctx context.Context,
	stream string,
	message redis.XMessage,
) error {
	eventType, ok :=
		message.Values["event_type"].(string)

	if !ok || eventType == "" {
		return fmt.Errorf(
			"intervention stream event missing event_type",
		)
	}

	if eventType != EventType {
		return fmt.Errorf(
			"unsupported intervention event type %q",
			eventType,
		)
	}

	eventID, ok :=
		message.Values["event_id"].(string)

	if !ok || eventID == "" {
		return fmt.Errorf(
			"intervention stream event missing event_id",
		)
	}

	payload, ok :=
		message.Values["payload"].(string)

	if !ok || payload == "" {
		return fmt.Errorf(
			"intervention stream event missing payload",
		)
	}

	var event Event

	if err :=
		json.Unmarshal(
			[]byte(payload),
			&event,
		); err != nil {

		return fmt.Errorf(
			"decode intervention payload: %w",
			err,
		)
	}

	if err :=
		event.Validate(); err != nil {

		return fmt.Errorf(
			"validate intervention payload: %w",
			err,
		)
	}

	if event.ID != eventID {
		return fmt.Errorf(
			"intervention event id mismatch: envelope=%q payload=%q",
			eventID,
			event.ID,
		)
	}

	if event.MeetingID !=
		c.lease.MeetingID {

		return fmt.Errorf(
			"intervention meeting mismatch: consumer=%q event=%q",
			c.lease.MeetingID,
			event.MeetingID,
		)
	}

	c.logger.Info(
		"intervention received",
		"meetingId",
		event.MeetingID,
		"streamId",
		message.ID,
		"eventId",
		event.ID,
		"gapId",
		event.GapID,
		"sprintItemId",
		event.SprintItemID,
		"observationId",
		event.ObservationID,
		"reason",
		event.Reason,
		"message",
		event.Message,
	)

	key :=
		deliveryKey(
			event.MeetingID,
			event.ID,
		)

	// ---------------------------------------------------------
	// Durable spoken-side-effect deduplication
	// ---------------------------------------------------------
	//
	// A Redis marker survives consumer/runtime restart.
	//
	// If the intervention was already spoken but remained
	// pending because acknowledgement did not complete, we
	// must not speak it again.
	state, err :=
		c.redis.Get(
			ctx,
			key,
		)

	switch {
	case err == nil &&
		state == deliveryStateDelivered:

		c.logger.Info(
			"intervention already delivered; skipping speech",
			"meetingId",
			event.MeetingID,
			"streamId",
			message.ID,
			"eventId",
			event.ID,
		)

		return c.completeDelivery(
			ctx,
			stream,
			message.ID,
			key,
			event,
		)

	case err == nil:

		return fmt.Errorf(
			"unexpected intervention delivery state %q for event %q",
			state,
			event.ID,
		)

	case errors.Is(
		err,
		redis.Nil,
	):
		// No durable delivery marker yet.
		//
		// Continue to the external audio side effect.

	default:
		return fmt.Errorf(
			"read intervention delivery state: %w",
			err,
		)
	}

	// ---------------------------------------------------------
	// External side effect
	// ---------------------------------------------------------
	//
	// This is deliberately performed before the durable
	// delivered marker is committed.
	//
	// If speaking itself fails, the Redis stream event remains
	// pending and no delivered marker exists, so recovery can
	// safely retry it.
	// Keep this stream entry in-flight through expected coordination
	// interruptions. The speaker waits on the floor; no recovery idle timer
	// and no delivered marker/ACK applies until speech succeeds or is stale.
	attemptSpeaker := c.speaker
	prepared := false
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err :=
			c.redis.FencedCheck(
				ctx,

				meetinglease.LeaseKey(
					c.lease.MeetingID,
				),

				meetinglease.FenceKey(
					c.lease.MeetingID,
				),

				c.lease.Token,
				c.lease.Fence,
			); err != nil {

			return fmt.Errorf(
				"verify intervention ownership before speaking: %w",
				err,
			)
		}

		if err := CheckCurrent(ctx, c.redis, event); err != nil {
			if errors.Is(err, ErrStale) {
				return c.completeDelivery(ctx, stream, message.ID, key, event)
			}
			return fmt.Errorf("check intervention gap: %w", err)
		}

		if !prepared {
			if preparing, ok := attemptSpeaker.(PreparingSpeaker); ok {
				var err error
				attemptSpeaker, err = preparing.Prepare(ctx, event)
				if err != nil {
					return fmt.Errorf("prepare intervention speech: %w", err)
				}
			}
			prepared = true
		}
		if err :=
			attemptSpeaker.Speak(
				ctx,
				event,
			); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if errors.Is(err, ErrStale) {
				return c.completeDelivery(ctx, stream, message.ID, key, event)
			}
			if errors.Is(err, speechfloor.ErrInterrupted) {
				c.logger.Info("intervention speech interrupted; waiting for quiet floor", "eventId", event.ID, "reason", err)
				continue
			}
			return fmt.Errorf("speak intervention: %w", err)
		}
		break
	}

	// ---------------------------------------------------------
	// Durable spoken-delivery marker
	// ---------------------------------------------------------
	//
	// Speech has completed successfully.
	//
	// Persist the delivered marker BEFORE acknowledgement so
	// pending recovery can detect the completed external side
	// effect and avoid speaking the same intervention again.

	if err :=
		c.redis.FencedSet(
			ctx,

			meetinglease.LeaseKey(
				c.lease.MeetingID,
			),

			meetinglease.FenceKey(
				c.lease.MeetingID,
			),

			c.lease.Token,
			c.lease.Fence,

			key,
			deliveryStateDelivered,
		); err != nil {

		return fmt.Errorf(
			"persist spoken intervention delivery: %w",
			err,
		)
	}

	// ---------------------------------------------------------
	// Stream acknowledgement
	// ---------------------------------------------------------
	//
	// completeDelivery performs the fenced pending-entry check
	// and ACK.
	//
	// It also writes the same delivered value again as part of
	// the atomic Redis operation. That write is intentionally
	// idempotent.

	return c.completeDelivery(
		ctx,
		stream,
		message.ID,
		key,
		event,
	)
}

func (c *Consumer) completeDelivery(
	ctx context.Context,
	stream string,
	messageID string,
	key string,
	event Event,
) error {
	if err :=
		c.redis.FencedXAckAndSet(
			ctx,

			meetinglease.LeaseKey(
				c.lease.MeetingID,
			),

			meetinglease.FenceKey(
				c.lease.MeetingID,
			),

			c.lease.Token,
			c.lease.Fence,

			stream,
			consumerGroup,
			messageID,

			key,
			deliveryStateDelivered,
		); err != nil {

		return fmt.Errorf(
			"persist intervention delivery and acknowledge: %w",
			err,
		)
	}

	c.logger.Info(
		"intervention delivery completed",
		"meetingId",
		event.MeetingID,
		"streamId",
		messageID,
		"eventId",
		event.ID,
		"fence",
		c.lease.Fence,
	)

	return nil
}

func (c *Consumer) recoverPending(
	ctx context.Context,
	stream string,
	minIdle time.Duration,
) error {
	start := "0-0"

	for {
		if ctx.Err() != nil {
			return nil
		}

		messages, next, err :=
			c.redis.XAutoClaim(
				ctx,
				stream,
				consumerGroup,
				c.consumerName,
				minIdle,
				start,
				readBatchSize,
			)

		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf(
				"recover pending interventions: %w",
				err,
			)
		}

		for _, message := range messages {

			c.logger.Info(
				"intervention consumer recovered pending event",
				"meetingId",
				c.lease.MeetingID,
				"streamId",
				message.ID,
				"minIdle",
				minIdle,
			)

			if err := c.process(
				ctx,
				stream,
				message,
			); err != nil {

				c.logger.Error(
					"failed to process recovered intervention",
					"meetingId",
					c.lease.MeetingID,
					"streamId",
					message.ID,
					"error",
					err,
				)

				continue
			}
		}

		if next == "0-0" {
			return nil
		}

		start = next
	}
}
