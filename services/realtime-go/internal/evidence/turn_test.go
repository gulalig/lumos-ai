package evidence

import (
	"testing"
	"time"
)

func TestNewTurnCreatesDeterministicEventID(
	t *testing.T,
) {
	t.Parallel()

	capturedAt := time.Date(
		2026,
		time.September,
		17,
		20,
		0,
		0,
		0,
		time.UTC,
	)

	first, err := NewTurn(
		"meeting_123",
		"participant_123",
		"track_123",
		7,
		"We decided to launch on Friday.",
		capturedAt,
	)
	if err != nil {
		t.Fatal(err)
	}

	second, err := NewTurn(
		"meeting_123",
		"participant_123",
		"track_123",
		7,
		"We decided to launch on Friday.",
		capturedAt,
	)
	if err != nil {
		t.Fatal(err)
	}

	if first.EventID != second.EventID {
		t.Fatalf(
			"expected deterministic event id: %s != %s",
			first.EventID,
			second.EventID,
		)
	}
}

func TestNewTurnRejectsEmptyText(
	t *testing.T,
) {
	t.Parallel()

	_, err := NewTurn(
		"meeting_123",
		"participant_123",
		"track_123",
		0,
		"   ",
		time.Now(),
	)

	if err != ErrEmptyText {
		t.Fatalf(
			"expected ErrEmptyText, got %v",
			err,
		)
	}
}
