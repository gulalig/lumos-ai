package meetinglifecycle

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"lumos/realtime-go/internal/redisclient"
)

const (
	replayBatchSize int64 = 200

	liveBatchSize int64 = 100

	liveReadBlock = 5 * time.Second
)

type Handler interface {
	Sync(
		ctx context.Context,
		meetings []ActiveMeeting,
	) error

	Handle(
		ctx context.Context,
		event Event,
	) error
}

type Consumer struct {
	redis  *redisclient.Client
	logger *slog.Logger
}

func NewConsumer(
	redisClient *redisclient.Client,
	logger *slog.Logger,
) (*Consumer, error) {
	if redisClient == nil {
		return nil, fmt.Errorf(
			"meeting lifecycle Redis client is required",
		)
	}

	if logger == nil {
		logger = slog.Default()
	}

	return &Consumer{
		redis:  redisClient,
		logger: logger,
	}, nil
}

func (c *Consumer) Run(
	ctx context.Context,
	handler Handler,
) error {
	if handler == nil {
		return fmt.Errorf(
			"meeting lifecycle handler is required",
		)
	}

	activeMeetings, lastID, err :=
		c.replay(
			ctx,
		)
	if err != nil {
		return err
	}

	c.logger.Info(
		"meeting lifecycle replay completed",
		"stream", StreamName,
		"lastStreamId", lastID,
		"activeMeetings", len(activeMeetings),
	)

	if err := handler.Sync(
		ctx,
		activeMeetings,
	); err != nil {
		return fmt.Errorf(
			"sync active meetings: %w",
			err,
		)
	}

	c.logger.Info(
		"meeting lifecycle consumer started",
		"stream", StreamName,
		"lastStreamId", lastID,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		streams, err := c.redis.XRead(
			ctx,
			StreamName,
			lastID,
			liveBatchSize,
			liveReadBlock,
		)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf(
				"read meeting lifecycle stream: %w",
				err,
			)
		}

		for _, stream := range streams {
			for _, message := range stream.Messages {
				event, err := ParseMessage(
					message,
				)
				if err != nil {
					return err
				}

				lastID = message.ID

				if !event.Type.IsKnown() {
					c.logger.Warn(
						"ignoring unknown meeting lifecycle event",
						"streamId", event.StreamID,
						"type", event.Type,
					)

					continue
				}

				if err := handler.Handle(
					ctx,
					event,
				); err != nil {
					return fmt.Errorf(
						"handle lifecycle event %s: %w",
						event.StreamID,
						err,
					)
				}
			}
		}
	}
}

func (c *Consumer) replay(
	ctx context.Context,
) ([]ActiveMeeting, string, error) {
	active := make(
		map[string]ActiveMeeting,
	)

	start := "-"
	lastID := "0-0"

	for {
		if ctx.Err() != nil {
			return nil, lastID, ctx.Err()
		}

		messages, err := c.redis.XRange(
			ctx,
			StreamName,
			start,
			"+",
			replayBatchSize,
		)
		if err != nil {
			return nil, lastID, fmt.Errorf(
				"replay meeting lifecycle stream: %w",
				err,
			)
		}

		if len(messages) == 0 {
			break
		}

		for _, message := range messages {
			event, err := ParseMessage(
				message,
			)
			if err != nil {
				return nil, lastID, err
			}

			lastID = message.ID

			if !event.Type.IsKnown() {
				c.logger.Warn(
					"ignoring unknown lifecycle event during replay",
					"streamId", event.StreamID,
					"type", event.Type,
				)

				continue
			}

			switch event.Type {
			case EventTypeStarted:
				active[event.MeetingID] =
					ActiveMeeting{
						MeetingID: event.MeetingID,

						RoomName: event.RoomName,
					}

			case EventTypeEnded:
				delete(
					active,
					event.MeetingID,
				)
			}
		}

		if int64(len(messages)) <
			replayBatchSize {
			break
		}

		// Redis XRANGE supports "(" to make
		// the range boundary exclusive.
		start = "(" + lastID
	}

	result := make(
		[]ActiveMeeting,
		0,
		len(active),
	)

	for _, meeting := range active {
		result = append(
			result,
			meeting,
		)
	}

	sort.Slice(
		result,
		func(
			left int,
			right int,
		) bool {
			return result[left].MeetingID <
				result[right].MeetingID
		},
	)

	return result, lastID, nil
}
