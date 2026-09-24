package semantics

import (
	"strings"
	"time"

	"lumos/realtime-go/internal/evidence"
)

const (
	// Normal conversational adjacency.
	MaxAdjacentTurnGap = 5 * time.Second

	// A user may answer a Lumos clarification or explicitly
	// correct/refine a commitment after a short pause.
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

	sameParticipant :=
		previous.ParticipantID ==
			current.ParticipantID

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

	if sameParticipant {
		// Same speaker may answer Lumos with:
		//
		//   "I'll take it."
		//   "Alex will ship the pricing page."
		if !containsExplicitOwnershipAcceptance(
			current.Text,
		) &&
			!containsExplicitNamedOwnershipAssignment(
				current.Text,
			) {

			return context
		}
	} else {
		// A different participant may only explicitly claim
		// ownership for themselves.
		if !containsExplicitOwnershipAcceptance(
			current.Text,
		) {

			return context
		}
	}

	previousCopy :=
		*previous

	context.Previous =
		&previousCopy

	return context
}

// NewDueDateRefinementContext exists specifically for the
// conversational flow:
//
//	commitment -> Lumos asks for due date -> participant answers
//
// For example:
//
//	"Lumos Developer will ship the pricing page."
//	Lumos: "When do we need this done?"
//	"On Friday."
//
// Lumos speech is not itself an evidence turn, so the previous
// participant turn may be more than MaxAdjacentTurnGap seconds old.
// We therefore allow a narrow, bounded clarification window.
//
// This function does NOT decide that a commitment is actually
// missing a due date. The meeting actor only calls it when its
// previous semantic state contains exactly one commitment with
// an owner and no due date.
func NewDueDateRefinementContext(
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

	if !containsExplicitDueDateAnswer(
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

func containsExplicitDueDateAnswer(
	text string,
) bool {
	normalized :=
		strings.ToLower(
			strings.TrimSpace(
				text,
			),
		)

	normalized =
		strings.Trim(
			normalized,
			" \t\r\n.,!?;:",
		)

	if normalized == "" {
		return false
	}

	weekdays :=
		[]string{
			"monday",
			"tuesday",
			"wednesday",
			"thursday",
			"friday",
			"saturday",
			"sunday",
		}

	for _, weekday := range weekdays {
		allowed :=
			[]string{
				weekday,
				"on " + weekday,
				"by " + weekday,
				"this " + weekday,
				"next " + weekday,
				"on this " + weekday,
				"on next " + weekday,
				"by this " + weekday,
				"by next " + weekday,
				weekday + " works",
				weekday + " should work",
				weekday + " is fine",
				weekday + " is good",
			}

		for _, value := range allowed {
			if normalized == value {
				return true
			}
		}
	}

	return false
}

func containsExplicitNamedOwnershipAssignment(
	text string,
) bool {
	normalized :=
		" " +
			strings.Join(
				strings.Fields(
					strings.ToLower(
						strings.TrimSpace(
							text,
						),
					),
				),
				" ",
			) +
			" "

	if normalized == "  " {
		return false
	}

	// Common explicit third-person ownership statements.
	markers := []string{
		" is responsible for ",
		" owns this ",
		" owns it ",
		" is taking this ",
		" is taking it ",
	}

	for _, marker := range markers {
		if strings.Contains(
			normalized,
			marker,
		) {
			return true
		}
	}

	// Named future assignment:
	//
	//   "Alex will ship the pricing page."
	//
	// Exclude pronoun/team forms because they do not establish
	// a grounded named owner.
	const willMarker = " will "

	index :=
		strings.Index(
			normalized,
			willMarker,
		)

	if index < 0 {
		return false
	}

	subject :=
		strings.TrimSpace(
			normalized[:index],
		)

	switch subject {
	case "",
		"i",
		"we",
		"you",
		"he",
		"she",
		"they",
		"it":

		return false
	}

	return true
}
