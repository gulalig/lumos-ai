package redisclient

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

func New(redisURL string) (*Client, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	return &Client{
		client: redis.NewClient(options),
	}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	if err := c.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping: %w", err)
	}

	return nil
}

func (c *Client) Close() error {
	return c.client.Close()
}

func (c *Client) XAdd(
	ctx context.Context,
	stream string,
	values map[string]any,
) (string, error) {
	id, err := c.client.XAdd(
		ctx,
		&redis.XAddArgs{
			Stream: stream,
			Values: values,
		},
	).Result()
	if err != nil {
		return "", fmt.Errorf(
			"redis xadd to %s: %w",
			stream,
			err,
		)
	}

	return id, nil
}

func (c *Client) XGroupCreateMkStream(
	ctx context.Context,
	stream string,
	group string,
	start string,
) error {
	err := c.client.XGroupCreateMkStream(
		ctx,
		stream,
		group,
		start,
	).Err()

	if err != nil &&
		!strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf(
			"create redis consumer group: %w",
			err,
		)
	}

	return nil
}

func (c *Client) XReadGroup(
	ctx context.Context,
	group string,
	consumer string,
	stream string,
	count int64,
	block time.Duration,
) ([]redis.XStream, error) {
	result, err := c.client.XReadGroup(
		ctx,
		&redis.XReadGroupArgs{
			Group:    group,
			Consumer: consumer,
			Streams:  []string{stream, ">"},
			Count:    count,
			Block:    block,
		},
	).Result()

	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, fmt.Errorf(
			"read redis stream group: %w",
			err,
		)
	}

	return result, nil
}

func (c *Client) XAck(
	ctx context.Context,
	stream string,
	group string,
	messageIDs ...string,
) error {
	if len(messageIDs) == 0 {
		return nil
	}

	if err := c.client.XAck(
		ctx,
		stream,
		group,
		messageIDs...,
	).Err(); err != nil {
		return fmt.Errorf(
			"ack redis stream messages: %w",
			err,
		)
	}

	return nil
}

func (c *Client) XAutoClaim(
	ctx context.Context,
	stream string,
	group string,
	consumer string,
	minIdle time.Duration,
	start string,
	count int64,
) ([]redis.XMessage, string, error) {
	messages, next, err := c.client.XAutoClaim(
		ctx,
		&redis.XAutoClaimArgs{
			Stream:   stream,
			Group:    group,
			Consumer: consumer,
			MinIdle:  minIdle,
			Start:    start,
			Count:    count,
		},
	).Result()

	if err != nil {
		return nil, "", fmt.Errorf(
			"auto-claim redis stream messages: %w",
			err,
		)
	}

	return messages, next, nil
}
