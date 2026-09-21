package redisclient

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const (
	fencedDeadLetterInvalidStateCode = "LUMOS_FENCED_DEAD_LETTER_INVALID_STATE"
)

const MaxDeadLetterSourcePayloadBytes = 64 * 1024

var ErrFencedDeadLetterInvalidState = errors.New(
	"fenced dead-letter commit rejected because Redis key state is invalid",
)

type FencedDeadLetterEntry struct {
	EventType string

	SourceEventType string

	SourceSchemaVersion string

	SourceEventID string

	SourcePayload string

	DeliveryCount int64

	Failure string

	DeadLetteredAt string
}

func (
	entry FencedDeadLetterEntry,
) validate() error {
	if strings.TrimSpace(
		entry.EventType,
	) == "" {
		return errors.New(
			"dead-letter event type is required",
		)
	}

	if strings.TrimSpace(
		entry.SourceEventType,
	) == "" {
		return errors.New(
			"dead-letter source event type is required",
		)
	}

	if strings.TrimSpace(
		entry.SourceEventID,
	) == "" {
		return errors.New(
			"dead-letter source event ID is required",
		)
	}

	if strings.TrimSpace(
		entry.SourcePayload,
	) == "" {
		return errors.New(
			"dead-letter source payload is required",
		)
	}

	if len(
		entry.SourcePayload,
	) > MaxDeadLetterSourcePayloadBytes {

		return fmt.Errorf(
			"dead-letter source payload exceeds maximum size: got %d bytes, max %d",
			len(entry.SourcePayload),
			MaxDeadLetterSourcePayloadBytes,
		)
	}

	if entry.DeliveryCount <= 0 {
		return errors.New(
			"dead-letter delivery count must be positive",
		)
	}

	if strings.TrimSpace(
		entry.Failure,
	) == "" {
		return errors.New(
			"dead-letter failure is required",
		)
	}

	if strings.TrimSpace(
		entry.DeadLetteredAt,
	) == "" {
		return errors.New(
			"dead-letter timestamp is required",
		)
	}

	return nil
}

const fencedDeadLetterAckScript = `
local function key_type(key)
	local result =
		redis.call(
			"TYPE",
			key
		)

	if type(result) == "table" then
		return result["ok"]
	end

	return result
end

local leaseType =
	key_type(
		KEYS[1]
	)

if leaseType ~= "string" then
	return redis.error_reply(
		"LUMOS_FENCED_DEAD_LETTER_INVALID_STATE lease key must be string"
	)
end

local fenceType =
	key_type(
		KEYS[2]
	)

if fenceType ~= "string" then
	return redis.error_reply(
		"LUMOS_FENCED_DEAD_LETTER_INVALID_STATE fence key must be string"
	)
end

local sourceType =
	key_type(
		KEYS[3]
	)

if sourceType ~= "stream" then
	return redis.error_reply(
		"LUMOS_FENCED_DEAD_LETTER_INVALID_STATE source key must be stream"
	)
end

local dlqType =
	key_type(
		KEYS[4]
	)

if dlqType ~= "none"
	and dlqType ~= "stream" then

	return redis.error_reply(
		"LUMOS_FENCED_DEAD_LETTER_INVALID_STATE dead-letter key must be stream or absent"
	)
end

local currentToken =
	redis.call(
		"GET",
		KEYS[1]
	)

if currentToken ~= ARGV[1] then
	return redis.error_reply(
		"LUMOS_FENCED_WRITE_REJECTED lease token mismatch"
	)
end

local currentFence =
	redis.call(
		"GET",
		KEYS[2]
	)

if currentFence ~= ARGV[2] then
	return redis.error_reply(
		"LUMOS_FENCED_WRITE_REJECTED fence mismatch"
	)
end

local pending =
	redis.call(
		"XPENDING",
		KEYS[3],
		ARGV[3],
		ARGV[4],
		ARGV[4],
		1
	)

if #pending ~= 1
	or pending[1][1] ~= ARGV[4] then

	return redis.error_reply(
		"LUMOS_FENCED_XACK_NOT_PENDING source entry is not pending"
	)
end

local dlqID =
	redis.call(
		"XADD",
		KEYS[4],
		"*",

		"event_type",
		ARGV[5],

		"source_stream_id",
		ARGV[4],

		"source_event_type",
		ARGV[6],

		"source_schema_version",
		ARGV[7],

		"source_event_id",
		ARGV[8],

		"source_payload",
		ARGV[9],

		"delivery_count",
		ARGV[10],

		"failure",
		ARGV[11],

		"dead_lettered_at",
		ARGV[12]
	)

local acknowledged =
	redis.call(
		"XACK",
		KEYS[3],
		ARGV[3],
		ARGV[4]
	)

if acknowledged ~= 1 then
	return redis.error_reply(
		"LUMOS_FENCED_DEAD_LETTER_ACK_INVARIANT"
	)
end

return dlqID
`

func (
	c *Client,
) FencedDeadLetterAndAck(
	ctx context.Context,

	leaseKey string,
	fenceKey string,

	leaseToken string,
	fence int64,

	sourceStream string,
	group string,
	messageID string,

	deadLetterStream string,

	entry FencedDeadLetterEntry,
) (
	string,
	error,
) {
	leaseKey =
		strings.TrimSpace(
			leaseKey,
		)

	fenceKey =
		strings.TrimSpace(
			fenceKey,
		)

	sourceStream =
		strings.TrimSpace(
			sourceStream,
		)

	deadLetterStream =
		strings.TrimSpace(
			deadLetterStream,
		)

	leaseToken =
		strings.TrimSpace(
			leaseToken,
		)

	group =
		strings.TrimSpace(
			group,
		)

	messageID =
		strings.TrimSpace(
			messageID,
		)

	if leaseKey == "" {
		return "",
			errors.New(
				"dead-letter lease key is required",
			)
	}

	if fenceKey == "" {
		return "",
			errors.New(
				"dead-letter fence key is required",
			)
	}

	if sourceStream == "" {
		return "",
			errors.New(
				"dead-letter source stream is required",
			)
	}

	if deadLetterStream == "" {
		return "",
			errors.New(
				"dead-letter destination stream is required",
			)
	}

	if sourceStream ==
		deadLetterStream {

		return "",
			errors.New(
				"dead-letter source and destination streams must differ",
			)
	}

	if leaseToken == "" {
		return "",
			errors.New(
				"dead-letter lease token is required",
			)
	}

	if fence <= 0 {
		return "",
			errors.New(
				"dead-letter lease fence must be positive",
			)
	}

	if group == "" {
		return "",
			errors.New(
				"dead-letter consumer group is required",
			)
	}

	if messageID == "" {
		return "",
			errors.New(
				"dead-letter source message ID is required",
			)
	}

	if err :=
		entry.validate(); err != nil {

		return "",
			err
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedDeadLetterAckScript,
			[]string{
				leaseKey,
				fenceKey,
				sourceStream,
				deadLetterStream,
			},
			leaseToken,
			strconv.FormatInt(
				fence,
				10,
			),
			group,
			messageID,
			entry.EventType,
			entry.SourceEventType,
			entry.SourceSchemaVersion,
			entry.SourceEventID,
			entry.SourcePayload,
			strconv.FormatInt(
				entry.DeliveryCount,
				10,
			),
			entry.Failure,
			entry.DeadLetteredAt,
		).Result()

	if err != nil {
		switch {
		case isFencedWriteRejected(
			err,
		):
			return "",
				fmt.Errorf(
					"fenced dead-letter commit: %w",
					ErrFencedWriteRejected,
				)

		case strings.Contains(
			err.Error(),
			fencedXAckNotPendingCode,
		):
			return "",
				fmt.Errorf(
					"fenced dead-letter commit: %w",
					ErrFencedXAckNotPending,
				)

		case strings.Contains(
			err.Error(),
			fencedDeadLetterInvalidStateCode,
		):
			return "",
				fmt.Errorf(
					"fenced dead-letter commit: %w",
					ErrFencedDeadLetterInvalidState,
				)

		default:
			// Once EVAL has been sent we cannot prove whether
			// Redis executed XADD + XACK before the response
			// was lost.
			return "",
				fmt.Errorf(
					"fenced dead-letter commit outcome unknown: %w: %w",
					ErrAtomicCommitOutcomeUnknown,
					err,
				)
		}
	}

	dlqID, ok :=
		result.(string)

	if !ok ||
		strings.TrimSpace(
			dlqID,
		) == "" {

		return "",
			fmt.Errorf(
				"fenced dead-letter commit returned unexpected result: %w",
				ErrAtomicCommitOutcomeUnknown,
			)
	}

	return dlqID,
		nil
}
