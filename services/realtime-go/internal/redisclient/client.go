package redisclient

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

type StreamGroupProgress struct {
	Pending         int64
	Lag             int64
	LastDeliveredID string
}

func New(
	redisURL string,
) (*Client, error) {
	options, err := redis.ParseURL(
		redisURL,
	)
	if err != nil {
		return nil, errors.New("REDIS_URL must be a valid native Redis URL")
	}
	// Upstash's native endpoint supports RESP2; avoid optional CLIENT SETINFO
	// and RESP3 push/maintenance commands that aren't used by our architecture.
	options.Protocol = 2
	options.DisableIdentity = true
	if options.TLSConfig != nil {
		options.TLSConfig.MinVersion = tls.VersionTLS12
	}

	return &Client{
		client: redis.NewClient(
			options,
		),
	}, nil
}

func (c *Client) Ping(
	ctx context.Context,
) error {
	if err := c.client.Ping(
		ctx,
	).Err(); err != nil {
		return fmt.Errorf(
			"redis ping: %w",
			err,
		)
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
		!strings.Contains(
			err.Error(),
			"BUSYGROUP",
		) {
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

			Streams: []string{
				stream,
				">",
			},

			Count: count,
			Block: block,
		},
	).Result()

	if err != nil &&
		!errors.Is(
			err,
			redis.Nil,
		) {
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
	messages, next, err :=
		c.client.XAutoClaim(
			ctx,
			&redis.XAutoClaimArgs{
				Stream: stream,
				Group:  group,

				Consumer: consumer,

				MinIdle: minIdle,

				Start: start,

				Count: count,
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

func (c *Client) XRange(
	ctx context.Context,
	stream string,
	start string,
	stop string,
	count int64,
) ([]redis.XMessage, error) {
	var (
		messages []redis.XMessage
		err      error
	)

	if count > 0 {
		messages, err =
			c.client.XRangeN(
				ctx,
				stream,
				start,
				stop,
				count,
			).Result()
	} else {
		messages, err =
			c.client.XRange(
				ctx,
				stream,
				start,
				stop,
			).Result()
	}

	if err != nil {
		return nil, fmt.Errorf(
			"range redis stream %s: %w",
			stream,
			err,
		)
	}

	return messages, nil
}

func (c *Client) XRead(
	ctx context.Context,
	stream string,
	lastID string,
	count int64,
	block time.Duration,
) ([]redis.XStream, error) {
	streams, err := c.client.XRead(
		ctx,
		&redis.XReadArgs{
			Streams: []string{
				stream,
				lastID,
			},

			Count: count,

			Block: block,
		},
	).Result()

	if err != nil {
		if errors.Is(
			err,
			redis.Nil,
		) {
			return nil, nil
		}

		return nil, fmt.Errorf(
			"read redis stream %s: %w",
			stream,
			err,
		)
	}

	return streams, nil
}

func (c *Client) XLastID(
	ctx context.Context,
	stream string,
) (string, error) {
	messages, err :=
		c.client.XRevRangeN(
			ctx,
			stream,
			"+",
			"-",
			1,
		).Result()

	if err != nil {
		return "", fmt.Errorf(
			"read last redis stream message %s: %w",
			stream,
			err,
		)
	}

	if len(messages) == 0 {
		return "0-0", nil
	}

	return messages[0].ID, nil
}

func (c *Client) XGroupProgress(
	ctx context.Context,
	stream string,
	group string,
) (StreamGroupProgress, error) {
	groups, err :=
		c.client.XInfoGroups(
			ctx,
			stream,
		).Result()

	if err != nil {
		return StreamGroupProgress{},
			fmt.Errorf(
				"read redis stream group info: %w",
				err,
			)
	}

	for _, info := range groups {
		if info.Name != group {
			continue
		}

		lastDeliveredID :=
			info.LastDeliveredID

		if lastDeliveredID == "" {
			lastDeliveredID = "0-0"
		}

		return StreamGroupProgress{
			Pending: info.Pending,

			Lag: info.Lag,

			LastDeliveredID: lastDeliveredID,
		}, nil
	}

	return StreamGroupProgress{},
		fmt.Errorf(
			"redis consumer group %q not found for stream %q",
			group,
			stream,
		)
}

func (c *Client) Get(
	ctx context.Context,
	key string,
) (string, error) {
	value, err :=
		c.client.Get(
			ctx,
			key,
		).Result()

	if err != nil {
		return "",
			err
	}

	return value,
		nil
}

func (c *Client) XAckAndSet(
	ctx context.Context,
	stream string,
	group string,
	messageID string,
	key string,
	value string,
) error {
	_, err :=
		c.client.TxPipelined(
			ctx,
			func(
				pipe redis.Pipeliner,
			) error {
				pipe.Set(
					ctx,
					key,
					value,
					0,
				)

				pipe.XAck(
					ctx,
					stream,
					group,
					messageID,
				)

				return nil
			},
		)

	if err != nil {
		return fmt.Errorf(
			"atomically checkpoint and acknowledge evidence: %w",
			err,
		)
	}

	return nil
}

func (c *Client) EvalInt64(
	ctx context.Context,
	script string,
	keys []string,
	args ...any,
) (int64, error) {
	result, err :=
		c.client.Eval(
			ctx,
			script,
			keys,
			args...,
		).Int64()

	if err != nil {
		return 0,
			fmt.Errorf(
				"redis eval: %w",
				err,
			)
	}

	return result, nil
}
