package meetingactor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

const (
	consumerGroup = "meeting-actor"

	readBatchSize = 16
	readBlockTime = 2 * time.Second

	pendingMinIdle = 5 * time.Second
)

type Consumer struct {
	redis *redisclient.Client
	actor *Actor

	meetingID    string
	consumerName string

	logger *slog.Logger
}

func NewConsumer(
	redisClient *redisclient.Client,
	actor *Actor,
	meetingID string,
	consumerName string,
	logger *slog.Logger,
) *Consumer {
	return &Consumer{
		redis:        redisClient,
		actor:        actor,
		meetingID:    meetingID,
		consumerName: consumerName,
		logger:       logger,
	}
}

func (c *Consumer) Run(
	ctx context.Context,
) error {
	stream := redisstream.EvidenceStreamKey(
		c.meetingID,
	)

	if err := c.redis.XGroupCreateMkStream(
		ctx,
		stream,
		consumerGroup,
		"0",
	); err != nil {
		return err
	}

	if err := c.recoverPending(
		ctx,
		stream,
	); err != nil {
		return err
	}

	c.logger.Info(
		"meeting actor consumer started",
		"meetingId", c.meetingID,
		"consumer", c.consumerName,
		"stream", stream,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		streams, err := c.redis.XReadGroup(
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

			return err
		}

		for _, result := range streams {
			for _, message := range result.Messages {
				if err := c.process(
					ctx,
					stream,
					message,
				); err != nil {
					c.logger.Error(
						"meeting actor failed to process evidence",
						"meetingId", c.meetingID,
						"streamId", message.ID,
						"error", err,
					)

					// Deliberately no ACK.
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

	if !ok {
		return fmt.Errorf(
			"stream event missing event_type",
		)
	}

	if eventType != "evidence.turn.final" {
		return fmt.Errorf(
			"unsupported event type %q",
			eventType,
		)
	}

	payload, ok :=
		message.Values["payload"].(string)

	if !ok {
		return fmt.Errorf(
			"stream event missing payload",
		)
	}

	if err := c.actor.HandleEvidence(
		ctx,
		payload,
	); err != nil {
		return err
	}

	if err := c.redis.XAck(
		ctx,
		stream,
		consumerGroup,
		message.ID,
	); err != nil {
		return err
	}

	c.logger.Info(
		"meeting actor acknowledged evidence",
		"meetingId", c.meetingID,
		"streamId", message.ID,
	)

	return nil
}

func (c *Consumer) recoverPending(
	ctx context.Context,
	stream string,
) error {
	start := "0-0"

	for {
		messages, next, err := c.redis.XAutoClaim(
			ctx,
			stream,
			consumerGroup,
			c.consumerName,
			pendingMinIdle,
			start,
			readBatchSize,
		)
		if err != nil {
			return fmt.Errorf(
				"recover pending evidence: %w",
				err,
			)
		}

		for _, message := range messages {
			c.logger.Info(
				"meeting actor recovered pending evidence",
				"meetingId", c.meetingID,
				"streamId", message.ID,
			)

			if err := c.process(
				ctx,
				stream,
				message,
			); err != nil {
				c.logger.Error(
					"meeting actor failed to process recovered evidence",
					"meetingId", c.meetingID,
					"streamId", message.ID,
					"error", err,
				)

				// Still no ACK.
				continue
			}
		}

		if next == "0-0" {
			return nil
		}

		start = next
	}
}
