package redisclient

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type PendingEntry struct {
	MessageID string
	Consumer  string

	Idle time.Duration

	DeliveryCount int64
}

func (c *Client) XPendingEntry(
	ctx context.Context,
	stream string,
	group string,
	messageID string,
) (
	PendingEntry,
	bool,
	error,
) {
	stream =
		strings.TrimSpace(
			stream,
		)

	group =
		strings.TrimSpace(
			group,
		)

	messageID =
		strings.TrimSpace(
			messageID,
		)

	if stream == "" {
		return PendingEntry{},
			false,
			errors.New(
				"pending entry stream is required",
			)
	}

	if group == "" {
		return PendingEntry{},
			false,
			errors.New(
				"pending entry consumer group is required",
			)
	}

	if messageID == "" {
		return PendingEntry{},
			false,
			errors.New(
				"pending entry message ID is required",
			)
	}

	entries, err :=
		c.client.XPendingExt(
			ctx,
			&redis.XPendingExtArgs{
				Stream: stream,
				Group:  group,

				Start: messageID,
				End:   messageID,

				Count: 1,
			},
		).Result()

	if err != nil {
		return PendingEntry{},
			false,
			fmt.Errorf(
				"read pending redis stream entry %q: %w",
				messageID,
				err,
			)
	}

	if len(entries) == 0 {
		return PendingEntry{},
			false,
			nil
	}

	entry :=
		entries[0]

	if entry.ID !=
		messageID {

		return PendingEntry{},
			false,
			fmt.Errorf(
				"pending redis stream lookup returned unexpected message ID %q for %q",
				entry.ID,
				messageID,
			)
	}

	return PendingEntry{
		MessageID: entry.ID,

		Consumer: entry.Consumer,

		Idle: entry.Idle,

		DeliveryCount: entry.RetryCount,
	}, true, nil
}
