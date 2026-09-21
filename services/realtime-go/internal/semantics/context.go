package semantics

import (
	"strings"
	"time"

	"lumos/realtime-go/internal/evidence"
)

const MaxAdjacentTurnGap = 5 * time.Second

// EvidenceContext contains the CURRENT durable evidence turn
// plus, when safe, its immediately preceding evidence turn.
//
// IMPORTANT:
//
// The caller must supply the immediately preceding processed
// evidence turn as previous.
//
// We intentionally do NOT use AssemblyAI TurnOrder to determine
// adjacency. TurnOrder belongs to an AssemblyAI realtime session
// and may restart from zero when the transcription session is
// recreated.
type EvidenceContext struct {
	Previous *evidence.Turn

	Current evidence.Turn
}

func NewEvidenceContext(
	previous *evidence.Turn,
	current evidence.Turn,
) EvidenceContext {
	context :=
		EvidenceContext{
			Current: current,
		}

	if previous == nil {
		return context
	}

	if !AreAdjacentTurns(
		*previous,
		current,
	) {
		return context
	}

	previousCopy :=
		*previous

	context.Previous =
		&previousCopy

	return context
}

func AreAdjacentTurns(
	previous evidence.Turn,
	current evidence.Turn,
) bool {
	if previous.EventID == "" ||
		current.EventID == "" {

		return false
	}

	// Never contextualize an event with itself.
	if previous.EventID ==
		current.EventID {

		return false
	}

	if previous.MeetingID == "" ||
		current.MeetingID == "" {

		return false
	}

	if previous.MeetingID !=
		current.MeetingID {

		return false
	}

	if previous.ParticipantID == "" ||
		current.ParticipantID == "" {

		return false
	}

	if previous.ParticipantID !=
		current.ParticipantID {

		return false
	}

	if previous.TrackID == "" ||
		current.TrackID == "" {

		return false
	}

	if previous.TrackID !=
		current.TrackID {

		return false
	}

	if previous.CapturedAt.IsZero() ||
		current.CapturedAt.IsZero() {

		return false
	}

	gap :=
		current.CapturedAt.Sub(
			previous.CapturedAt,
		)

	if gap < 0 {
		return false
	}

	if gap >
		MaxAdjacentTurnGap {

		return false
	}

	return true
}

func (c EvidenceContext) HasPrevious() bool {
	return c.Previous != nil
}

func (c EvidenceContext) GroundingText() string {
	if c.Previous == nil {
		return strings.TrimSpace(
			c.Current.Text,
		)
	}

	return strings.TrimSpace(
		c.Previous.Text +
			"\n" +
			c.Current.Text,
	)
}
