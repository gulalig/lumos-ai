package semantics

import (
	"strings"
	"time"

	"lumos/realtime-go/internal/evidence"
)

const (
	// Normal conversational adjacency.
	MaxAdjacentTurnGap = 5 * time.Second

	// A user may correct a commitment after a short pause.
	//
	// We only use this wider window when the CURRENT turn
	// contains an explicit correction / revision cue.
	MaxRefinementTurnGap = 45 * time.Second
)

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

func NewOwnershipRefinementContext(
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

	if previous.EventID == "" ||
		current.EventID == "" {

		return context
	}

	if previous.EventID ==
		current.EventID {

		return context
	}

	if previous.MeetingID == "" ||
		current.MeetingID == "" ||
		previous.MeetingID !=
			current.MeetingID {

		return context
	}

	if previous.ParticipantID == "" ||
		current.ParticipantID == "" {

		return context
	}

	// This path exists specifically for another
	// participant answering an unresolved ownership
	// question.
	if previous.ParticipantID ==
		current.ParticipantID {

		return context
	}

	if previous.CapturedAt.IsZero() ||
		current.CapturedAt.IsZero() {

		return context
	}

	gap :=
		current.CapturedAt.Sub(
			previous.CapturedAt,
		)

	if gap < 0 ||
		gap > MaxRefinementTurnGap {

		return context
	}

	if !containsExplicitOwnershipAcceptance(
		current.Text,
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

	// Normal adjacent conversation.
	if gap <=
		MaxAdjacentTurnGap {

		return true
	}

	// Outside the normal adjacency window we fail closed
	// unless the current turn explicitly looks like a
	// correction / revision.
	if gap >
		MaxRefinementTurnGap {

		return false
	}

	return HasExplicitRefinementCue(
		current.Text,
	)
}

func HasExplicitRefinementCue(
	text string,
) bool {
	normalized :=
		strings.ToLower(
			strings.TrimSpace(
				text,
			),
		)

	if normalized == "" {
		return false
	}

	cues := []string{
		"actually",
		"correction",
		"i mean",
		"instead",
		"rather",
		"change that",
		"change it",
		"not friday",
		"not monday",
		"not tuesday",
		"not wednesday",
		"not thursday",
		"not saturday",
		"not sunday",
	}

	for _, cue := range cues {

		if strings.Contains(
			normalized,
			cue,
		) {
			return true
		}
	}

	return false
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
