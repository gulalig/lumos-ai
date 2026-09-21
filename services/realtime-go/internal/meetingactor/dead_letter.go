package meetingactor

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

const (
	maxEvidenceDeliveryCount int64 = 5

	maxDeadLetterFailureRunes = 2048
)

func (
	c *Consumer,
) resolveProcessFailure(
	ctx context.Context,
	stream string,
	message redis.XMessage,
	processErr error,
) (
	bool,
	error,
) {
	if processErr == nil {
		return false, nil
	}

	// Ownership loss, unknown atomic commit outcome, and other
	// hard invariants must never enter the retry/DLQ path.
	if isFatalProcessError(
		processErr,
	) {
		return false, processErr
	}

	deadLettered, err :=
		c.maybeDeadLetterRetryableFailure(
			ctx,
			stream,
			message,
			processErr,
		)

	if err == nil {
		return deadLettered, nil
	}

	classified :=
		classifyProcessError(
			err,
		)

	if isFatalProcessError(
		classified,
	) {
		return false, classified
	}

	// A transient failure while reading retry metadata does not
	// justify dropping the evidence.
	//
	// Leave it pending and try again later.
	c.logger.Error(
		"meeting actor failed to evaluate evidence retry budget",

		"meetingId",
		c.lease.MeetingID,

		"streamId",
		message.ID,

		"error",
		classified,
	)

	return false, nil
}

func (
	c *Consumer,
) maybeDeadLetterRetryableFailure(
	ctx context.Context,
	stream string,
	message redis.XMessage,
	processErr error,
) (
	bool,
	error,
) {
	pending, exists, err :=
		c.redis.XPendingEntry(
			ctx,
			stream,
			consumerGroup,
			message.ID,
		)

	if err != nil {
		return false,
			fmt.Errorf(
				"read evidence retry metadata: %w",
				err,
			)
	}

	if !exists {
		// process() failed and therefore never legitimately ACKed
		// this evidence.
		//
		// If it disappeared from the PEL, our assumptions are no
		// longer valid. Fail closed instead of continuing.
		return false,
			fmt.Errorf(
				"evidence %q disappeared from pending list before retry-budget decision: %w",
				message.ID,
				redisclient.ErrFencedXAckNotPending,
			)
	}

	if pending.DeliveryCount <
		maxEvidenceDeliveryCount {

		return false, nil
	}

	meetingID :=
		c.lease.MeetingID

	entry :=
		redisclient.FencedDeadLetterEntry{
			EventType: redisstream.EvidenceDeadLetterEventType,

			SourceEventType: messageValueString(
				message,
				"event_type",
				"unknown",
			),

			SourceSchemaVersion: messageValueString(
				message,
				"schema_version",
				"unknown",
			),

			SourceEventID: messageValueString(
				message,
				"event_id",
				"unknown",
			),

			SourcePayload: boundedDeadLetterSourcePayload(
				messageValueString(
					message,
					"payload",
					"<missing>",
				),
			),

			DeliveryCount: pending.DeliveryCount,

			Failure: boundedDeadLetterFailure(
				processErr,
			),

			DeadLetteredAt: time.Now().
				UTC().
				Format(
					time.RFC3339Nano,
				),
		}

	dlqID, err :=
		c.redis.FencedDeadLetterAndAck(
			ctx,

			meetinglease.LeaseKey(
				meetingID,
			),

			meetinglease.FenceKey(
				meetingID,
			),

			c.lease.Token,
			c.lease.Fence,

			stream,
			consumerGroup,
			message.ID,

			redisstream.EvidenceDeadLetterStreamKey(
				meetingID,
			),

			entry,
		)

	if err != nil {
		return false,
			fmt.Errorf(
				"dead-letter poison evidence: %w",
				err,
			)
	}

	// The fenced DLQ transaction has definitely succeeded:
	//
	// - source evidence was appended to DLQ
	// - source evidence was ACKed
	//
	// Only now may observability state move forward.
	if c.actor.metrics != nil {
		c.actor.metrics.IncDeadLetter()

		c.actor.metrics.
			AddMeetingEvidencePending(
				meetingID,
				-1,
			)
	}

	c.logger.Warn(
		"meeting actor dead-lettered poison evidence",

		"meetingId",
		meetingID,

		"sourceStreamId",
		message.ID,

		"deadLetterStreamId",
		dlqID,

		"deliveryCount",
		pending.DeliveryCount,

		"fence",
		c.lease.Fence,

		"failure",
		entry.Failure,
	)

	return true, nil
}

func messageValueString(
	message redis.XMessage,
	key string,
	fallback string,
) string {
	value, exists :=
		message.Values[key]

	if !exists ||
		value == nil {

		return fallback
	}

	text :=
		fmt.Sprint(
			value,
		)

	if strings.TrimSpace(
		text,
	) == "" {

		return fallback
	}

	return text
}

func boundedDeadLetterFailure(
	err error,
) string {
	if err == nil {
		return "unknown processing failure"
	}

	text :=
		strings.TrimSpace(
			err.Error(),
		)

	if text == "" {
		return "unknown processing failure"
	}

	runes :=
		[]rune(
			text,
		)

	if len(runes) <=
		maxDeadLetterFailureRunes {

		return text
	}

	return string(
		runes[:maxDeadLetterFailureRunes],
	)
}

func boundedDeadLetterSourcePayload(
	payload string,
) string {
	if len(payload) <=
		redisclient.MaxDeadLetterSourcePayloadBytes {

		return payload
	}

	suffix :=
		fmt.Sprintf(
			"\n...[truncated; original_bytes=%d]",
			len(payload),
		)

	maxPrefixBytes :=
		redisclient.MaxDeadLetterSourcePayloadBytes -
			len(suffix)

	cut :=
		maxPrefixBytes

	// Preserve UTF-8 boundaries when the original payload itself
	// is valid UTF-8.
	//
	// Redis strings may contain arbitrary bytes, but keeping
	// forensic DLQ text valid makes logs and manual inspection
	// safer.
	if utf8.ValidString(
		payload,
	) {
		for cut > 0 &&
			cut < len(payload) &&
			!utf8.RuneStart(
				payload[cut],
			) {

			cut--
		}
	}

	return payload[:cut] +
		suffix
}
