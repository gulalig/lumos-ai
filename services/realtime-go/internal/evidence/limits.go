package evidence

import (
	"errors"
	"fmt"
)

const (
	MaxTurnTextBytes = 32 * 1024

	// Includes the JSON envelope around Turn.Text.
	//
	// This guard is intentionally checked BEFORE json.Unmarshal
	// so malformed or hostile durable evidence cannot force
	// arbitrarily large JSON allocations.
	MaxTurnPayloadBytes = 64 * 1024
)

var ErrTurnTextTooLarge = errors.New(
	"evidence turn text exceeds maximum size",
)

var ErrTurnPayloadTooLarge = errors.New(
	"evidence turn payload exceeds maximum size",
)

func validateTurnTextSize(
	text string,
) error {
	size :=
		len(
			text,
		)

	if size <=
		MaxTurnTextBytes {

		return nil
	}

	return fmt.Errorf(
		"%w: got %d bytes, max %d",
		ErrTurnTextTooLarge,
		size,
		MaxTurnTextBytes,
	)
}

func ValidateTurnResourceLimits(
	turn Turn,
) error {
	return validateTurnTextSize(
		turn.Text,
	)
}

func ValidateTurnPayloadResourceLimits(
	payload string,
) error {
	size :=
		len(
			payload,
		)

	if size <=
		MaxTurnPayloadBytes {

		return nil
	}

	return fmt.Errorf(
		"%w: got %d bytes, max %d",
		ErrTurnPayloadTooLarge,
		size,
		MaxTurnPayloadBytes,
	)
}
