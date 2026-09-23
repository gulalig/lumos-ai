package intervention

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

const (
	consumerGroup = "realtime-intervention"

	readBatchSize = 16

	readBlockTime = 2 * time.Second

	pendingRetryMinIdle = 5 * time.Second
)

type Consumer struct {
	redis *redisclient.Client

	meetingID string

	consumerName string

	speaker Speaker

	logger *slog.Logger
}

func NewConsumer(
	redisClient *redisclient.Client,
	meetingID string,
	consumerName string,
	speaker Speaker,
	logger *slog.Logger,
) *Consumer {
	if logger == nil {
		logger = slog.Default()
	}

	return &Consumer{
		redis: redisClient,

		meetingID: meetingID,

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

	if c.meetingID == "" {
		return fmt.Errorf(
			"intervention consumer meeting ID is required",
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
			c.meetingID,
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
	// minIdle = 0 allows a new runtime instance to
	// take over work left pending by an older consumer.
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
		"meetingId", c.meetingID,
		"consumer", c.consumerName,
		"stream", stream,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		// Retry transiently failed pending events without
		// creating a hot loop.
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
						"meetingId", c.meetingID,
						"streamId", message.ID,
						"error", err,
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

	if err := event.Validate(); err != nil {
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

	if event.MeetingID != c.meetingID {
		return fmt.Errorf(
			"intervention meeting mismatch: consumer=%q event=%q",
			c.meetingID,
			event.MeetingID,
		)
	}

	c.logger.Info(
		"intervention received",
		"meetingId", event.MeetingID,
		"streamId", message.ID,
		"eventId", event.ID,
		"gapId", event.GapID,
		"sprintItemId", event.SprintItemID,
		"observationId", event.ObservationID,
		"reason", event.Reason,
		"message", event.Message,
	)

	// -------------------------------------------------------------------------
	// Side effect
	// -------------------------------------------------------------------------
	//
	// The intervention must only be ACKed after the
	// speaker successfully handles it.
	//
	// Today LogSpeaker only logs the request.
	// Later this becomes:
	//
	// TTS -> PCM -> LiveKit audio publication.
	//
	// If speaking fails, the event remains pending.
	if err :=
		c.speaker.Speak(
			ctx,
			event,
		); err != nil {

		return fmt.Errorf(
			"speak intervention: %w",
			err,
		)
	}

	// -------------------------------------------------------------------------
	// Durable completion
	// -------------------------------------------------------------------------

	if err := c.redis.XAck(
		ctx,
		stream,
		consumerGroup,
		message.ID,
	); err != nil {
		return fmt.Errorf(
			"ack intervention: %w",
			err,
		)
	}

	c.logger.Info(
		"intervention acknowledged",
		"meetingId", event.MeetingID,
		"streamId", message.ID,
		"eventId", event.ID,
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
				"meetingId", c.meetingID,
				"streamId", message.ID,
				"minIdle", minIdle,
			)

			if err := c.process(
				ctx,
				stream,
				message,
			); err != nil {

				c.logger.Error(
					"failed to process recovered intervention",
					"meetingId", c.meetingID,
					"streamId", message.ID,
					"error", err,
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
