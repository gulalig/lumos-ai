package redisclient

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const (
	fencedWriteRejectedCode  = "LUMOS_FENCED_WRITE_REJECTED"
	fencedXAckNotPendingCode = "LUMOS_FENCED_XACK_NOT_PENDING"
)

var (
	ErrFencedWriteRejected = errors.New(
		"fenced redis write rejected because the meeting lease is no longer current",
	)

	ErrFencedXAckNotPending = errors.New(
		"fenced redis acknowledgement rejected because the stream entry is not pending",
	)
)

const fencedCheckScript = `
local currentToken = redis.call("GET", KEYS[1])

if not currentToken or currentToken ~= ARGV[1] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentFence = redis.call("GET", KEYS[2])

if not currentFence or currentFence ~= ARGV[2] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

return 1
`

const fencedSetScript = `
local currentToken = redis.call("GET", KEYS[1])

if not currentToken or currentToken ~= ARGV[1] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentFence = redis.call("GET", KEYS[2])

if not currentFence or currentFence ~= ARGV[2] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

redis.call(
	"SET",
	KEYS[3],
	ARGV[3]
)

return 1
`

const fencedXAddScript = `
local currentToken = redis.call("GET", KEYS[1])

if not currentToken or currentToken ~= ARGV[1] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentFence = redis.call("GET", KEYS[2])

if not currentFence or currentFence ~= ARGV[2] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

return redis.call(
	"XADD",
	KEYS[3],
	"*",
	unpack(ARGV, 3)
)
`

const fencedXAckAndSetScript = `
local currentToken = redis.call("GET", KEYS[1])

if not currentToken or currentToken ~= ARGV[1] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentFence = redis.call("GET", KEYS[2])

if not currentFence or currentFence ~= ARGV[2] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local pending = redis.call(
	"XPENDING",
	KEYS[4],
	ARGV[4],
	ARGV[5],
	ARGV[5],
	1
)

if #pending ~= 1 or pending[1][1] ~= ARGV[5] then
	return redis.error_reply("LUMOS_FENCED_XACK_NOT_PENDING")
end

redis.call(
	"SET",
	KEYS[3],
	ARGV[3]
)

local acknowledged = redis.call(
	"XACK",
	KEYS[4],
	ARGV[4],
	ARGV[5]
)

if acknowledged ~= 1 then
	return redis.error_reply("LUMOS_FENCED_XACK_NOT_PENDING")
end

return 1
`

func (c *Client) FencedCheck(
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence int64,
) error {
	if strings.TrimSpace(leaseKey) == "" {
		return errors.New(
			"fenced check lease key is required",
		)
	}

	if strings.TrimSpace(fenceKey) == "" {
		return errors.New(
			"fenced check fence key is required",
		)
	}

	if strings.TrimSpace(token) == "" {
		return errors.New(
			"fenced check lease token is required",
		)
	}

	if fence <= 0 {
		return errors.New(
			"fenced check fence must be positive",
		)
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedCheckScript,
			[]string{
				leaseKey,
				fenceKey,
			},
			token,
			strconv.FormatInt(
				fence,
				10,
			),
		).Int64()

	if err != nil {
		if isFencedWriteRejected(
			err,
		) {
			return fmt.Errorf(
				"fenced ownership check: %w",
				ErrFencedWriteRejected,
			)
		}

		return fmt.Errorf(
			"fenced ownership check: %w",
			err,
		)
	}

	if result != 1 {
		return fmt.Errorf(
			"fenced ownership check returned unexpected result %d",
			result,
		)
	}

	return nil
}

func (c *Client) FencedSet(
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence int64,
	key string,
	value string,
) error {
	if strings.TrimSpace(leaseKey) == "" {
		return errors.New(
			"fenced set lease key is required",
		)
	}

	if strings.TrimSpace(fenceKey) == "" {
		return errors.New(
			"fenced set fence key is required",
		)
	}

	if strings.TrimSpace(token) == "" {
		return errors.New(
			"fenced set lease token is required",
		)
	}

	if fence <= 0 {
		return errors.New(
			"fenced set fence must be positive",
		)
	}

	if strings.TrimSpace(key) == "" {
		return errors.New(
			"fenced set key is required",
		)
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedSetScript,
			[]string{
				leaseKey,
				fenceKey,
				key,
			},
			token,
			strconv.FormatInt(
				fence,
				10,
			),
			value,
		).Int64()

	if err != nil {
		if isFencedWriteRejected(
			err,
		) {
			return fmt.Errorf(
				"fenced set: %w",
				ErrFencedWriteRejected,
			)
		}

		return fmt.Errorf(
			"fenced set: %w",
			err,
		)
	}

	if result != 1 {
		return fmt.Errorf(
			"fenced set returned unexpected result %d",
			result,
		)
	}

	return nil
}

func (c *Client) FencedXAdd(
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence int64,
	stream string,
	values map[string]any,
) (string, error) {
	if strings.TrimSpace(leaseKey) == "" {
		return "", errors.New(
			"fenced redis write lease key is required",
		)
	}

	if strings.TrimSpace(fenceKey) == "" {
		return "", errors.New(
			"fenced redis write fence key is required",
		)
	}

	if strings.TrimSpace(token) == "" {
		return "", errors.New(
			"fenced redis write lease token is required",
		)
	}

	if fence <= 0 {
		return "", errors.New(
			"fenced redis write fence must be positive",
		)
	}

	if strings.TrimSpace(stream) == "" {
		return "", errors.New(
			"fenced redis write stream is required",
		)
	}

	if len(values) == 0 {
		return "", errors.New(
			"fenced redis xadd values are required",
		)
	}

	fields := make(
		[]string,
		0,
		len(values),
	)

	for field := range values {
		if strings.TrimSpace(field) == "" {
			return "", errors.New(
				"fenced redis xadd field name is required",
			)
		}

		fields = append(
			fields,
			field,
		)
	}

	sort.Strings(fields)

	args := make(
		[]any,
		0,
		2+(len(fields)*2),
	)

	args = append(
		args,
		token,
		strconv.FormatInt(
			fence,
			10,
		),
	)

	for _, field := range fields {
		args = append(
			args,
			field,
			values[field],
		)
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedXAddScript,
			[]string{
				leaseKey,
				fenceKey,
				stream,
			},
			args...,
		).Result()

	if err != nil {
		if isFencedWriteRejected(
			err,
		) {
			return "", fmt.Errorf(
				"fenced redis xadd to %s: %w",
				stream,
				ErrFencedWriteRejected,
			)
		}

		return "", fmt.Errorf(
			"fenced redis xadd to %s: %w",
			stream,
			err,
		)
	}

	switch value := result.(type) {
	case string:
		return value, nil

	case []byte:
		return string(value), nil

	default:
		return "", fmt.Errorf(
			"fenced redis xadd returned unexpected result type %T",
			result,
		)
	}
}

func (c *Client) FencedXAckAndSet(
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence int64,
	stream string,
	group string,
	messageID string,
	key string,
	value string,
) error {
	if strings.TrimSpace(leaseKey) == "" {
		return errors.New(
			"fenced redis write lease key is required",
		)
	}

	if strings.TrimSpace(fenceKey) == "" {
		return errors.New(
			"fenced redis write fence key is required",
		)
	}

	if strings.TrimSpace(token) == "" {
		return errors.New(
			"fenced redis write lease token is required",
		)
	}

	if fence <= 0 {
		return errors.New(
			"fenced redis write fence must be positive",
		)
	}

	if strings.TrimSpace(stream) == "" {
		return errors.New(
			"fenced redis write stream is required",
		)
	}

	if strings.TrimSpace(group) == "" {
		return errors.New(
			"fenced redis xack group is required",
		)
	}

	if strings.TrimSpace(messageID) == "" {
		return errors.New(
			"fenced redis xack message ID is required",
		)
	}

	if strings.TrimSpace(key) == "" {
		return errors.New(
			"fenced redis checkpoint key is required",
		)
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedXAckAndSetScript,
			[]string{
				leaseKey,
				fenceKey,
				key,
				stream,
			},
			token,
			strconv.FormatInt(
				fence,
				10,
			),
			value,
			group,
			messageID,
		).Int64()

	if err != nil {
		switch {
		case isFencedWriteRejected(
			err,
		):
			return fmt.Errorf(
				"fenced checkpoint and evidence acknowledgement: %w",
				ErrFencedWriteRejected,
			)

		case strings.Contains(
			err.Error(),
			fencedXAckNotPendingCode,
		):
			return fmt.Errorf(
				"fenced checkpoint and evidence acknowledgement: %w",
				ErrFencedXAckNotPending,
			)

		default:
			return fmt.Errorf(
				"fenced checkpoint and evidence acknowledgement: %w",
				err,
			)
		}
	}

	if result != 1 {
		return fmt.Errorf(
			"fenced checkpoint and evidence acknowledgement returned unexpected result %d",
			result,
		)
	}

	return nil
}

func isFencedWriteRejected(
	err error,
) bool {
	if err == nil {
		return false
	}

	return strings.Contains(
		err.Error(),
		fencedWriteRejectedCode,
	)
}
