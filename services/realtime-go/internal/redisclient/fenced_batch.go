package redisclient

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const fencedBatchInvalidStateCode = "LUMOS_FENCED_BATCH_INVALID_STATE"

var ErrFencedBatchInvalidState = errors.New(
	"fenced redis batch commit rejected because Redis key state is invalid",
)

var ErrAtomicCommitOutcomeUnknown = errors.New(
	"atomic redis commit outcome is unknown",
)

type FencedStreamEntry struct {
	EventType string
	EventID   string
	Payload   string
}

const fencedXAddBatchAckAndSetScript = `
local leaseType = redis.call("TYPE", KEYS[1]).ok

if leaseType ~= "string" then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentToken = redis.call("GET", KEYS[1])

if not currentToken or currentToken ~= ARGV[1] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local fenceType = redis.call("TYPE", KEYS[2]).ok

if fenceType ~= "string" then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local currentFence = redis.call("GET", KEYS[2])

if not currentFence or currentFence ~= ARGV[2] then
	return redis.error_reply("LUMOS_FENCED_WRITE_REJECTED")
end

local checkpointType = redis.call("TYPE", KEYS[3]).ok

if checkpointType ~= "none" and checkpointType ~= "string" then
	return redis.error_reply("LUMOS_FENCED_BATCH_INVALID_STATE")
end

local sourceType = redis.call("TYPE", KEYS[4]).ok

if sourceType ~= "stream" then
	return redis.error_reply("LUMOS_FENCED_BATCH_INVALID_STATE")
end

local destinationType = redis.call("TYPE", KEYS[5]).ok

if destinationType ~= "none" and destinationType ~= "stream" then
	return redis.error_reply("LUMOS_FENCED_BATCH_INVALID_STATE")
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

local entryCount = tonumber(ARGV[6])

if not entryCount or entryCount < 0 then
	return redis.error_reply("LUMOS_FENCED_BATCH_INVALID_STATE")
end

if #ARGV ~= 6 + (entryCount * 3) then
	return redis.error_reply("LUMOS_FENCED_BATCH_INVALID_STATE")
end

local argIndex = 7

for i = 1, entryCount do
	redis.call(
		"XADD",
		KEYS[5],
		"*",
		"event_type",
		ARGV[argIndex],
		"event_id",
		ARGV[argIndex + 1],
		"payload",
		ARGV[argIndex + 2]
	)

	argIndex = argIndex + 3
end

redis.call(
	"SET",
	KEYS[3],
	ARGV[3]
)

redis.call(
	"XACK",
	KEYS[4],
	ARGV[4],
	ARGV[5]
)

return entryCount
`

func (c *Client) FencedXAddBatchAckAndSet(
	ctx context.Context,
	leaseKey string,
	fenceKey string,
	token string,
	fence int64,
	sourceStream string,
	group string,
	messageID string,
	checkpointKey string,
	checkpointValue string,
	destinationStream string,
	entries []FencedStreamEntry,
) (int64, error) {
	namedKeys :=
		[]struct {
			name  string
			value string
		}{
			{
				name:  "lease",
				value: leaseKey,
			},
			{
				name:  "fence",
				value: fenceKey,
			},
			{
				name:  "checkpoint",
				value: checkpointKey,
			},
			{
				name:  "source stream",
				value: sourceStream,
			},
			{
				name:  "destination stream",
				value: destinationStream,
			},
		}

	seenKeys :=
		make(
			map[string]string,
			len(namedKeys),
		)

	for _, key := range namedKeys {
		if strings.TrimSpace(
			key.value,
		) == "" {
			return 0, fmt.Errorf(
				"fenced batch %s key is required",
				key.name,
			)
		}

		if previous, exists :=
			seenKeys[key.value]; exists {

			return 0, fmt.Errorf(
				"fenced batch keys must be distinct: %s and %s use %q",
				previous,
				key.name,
				key.value,
			)
		}

		seenKeys[key.value] =
			key.name
	}

	if strings.TrimSpace(token) == "" {
		return 0, errors.New(
			"fenced batch lease token is required",
		)
	}

	if fence <= 0 {
		return 0, errors.New(
			"fenced batch fence must be positive",
		)
	}

	if strings.TrimSpace(group) == "" {
		return 0, errors.New(
			"fenced batch consumer group is required",
		)
	}

	if strings.TrimSpace(messageID) == "" {
		return 0, errors.New(
			"fenced batch message ID is required",
		)
	}

	if strings.TrimSpace(
		checkpointValue,
	) == "" {
		return 0, errors.New(
			"fenced batch checkpoint value is required",
		)
	}

	args :=
		make(
			[]any,
			0,
			6+(len(entries)*3),
		)

	args =
		append(
			args,
			token,
			strconv.FormatInt(
				fence,
				10,
			),
			checkpointValue,
			group,
			messageID,
			strconv.Itoa(
				len(entries),
			),
		)

	for _, entry := range entries {

		if strings.TrimSpace(
			entry.EventType,
		) == "" {
			return 0, errors.New(
				"fenced batch event type is required",
			)
		}

		if strings.TrimSpace(
			entry.EventID,
		) == "" {
			return 0, errors.New(
				"fenced batch event ID is required",
			)
		}

		if strings.TrimSpace(
			entry.Payload,
		) == "" {
			return 0, errors.New(
				"fenced batch event payload is required",
			)
		}

		args =
			append(
				args,
				entry.EventType,
				entry.EventID,
				entry.Payload,
			)
	}

	result, err :=
		c.client.Eval(
			ctx,
			fencedXAddBatchAckAndSetScript,
			[]string{
				leaseKey,
				fenceKey,
				checkpointKey,
				sourceStream,
				destinationStream,
			},
			args...,
		).Int64()

	if err != nil {
		switch {
		case isFencedWriteRejected(
			err,
		):
			return 0, fmt.Errorf(
				"fenced semantic batch commit: %w",
				ErrFencedWriteRejected,
			)

		case strings.Contains(
			err.Error(),
			fencedXAckNotPendingCode,
		):
			return 0, fmt.Errorf(
				"fenced semantic batch commit: %w",
				ErrFencedXAckNotPending,
			)

		case strings.Contains(
			err.Error(),
			fencedBatchInvalidStateCode,
		):
			return 0, fmt.Errorf(
				"fenced semantic batch commit: %w",
				ErrFencedBatchInvalidState,
			)

		default:
			// Once EVAL has been sent, a transport/client error does not
			// prove whether Redis executed the Lua script.
			//
			// The server may already have committed:
			//
			//   semantic XADDs
			//   checkpoint SET
			//   source XACK
			//
			// Therefore the caller MUST NOT continue with the current
			// in-memory Actor state. The safe recovery path is runtime
			// restart + durable checkpoint restore.
			return 0, fmt.Errorf(
				"fenced semantic batch commit outcome unknown: %w: %w",
				ErrAtomicCommitOutcomeUnknown,
				err,
			)
		}
	}

	if result !=
		int64(
			len(entries),
		) {

		// A successful Lua response with an unexpected result is an
		// invariant violation after the commit boundary may already
		// have mutated Redis. Treat it exactly like an uncertain
		// outcome: fail closed and rebuild Actor memory from the
		// durable checkpoint on restart.
		return 0, fmt.Errorf(
			"fenced semantic batch commit outcome inconsistent: %w: returned %d entries, expected %d",
			ErrAtomicCommitOutcomeUnknown,
			result,
			len(entries),
		)
	}

	return result, nil
}
