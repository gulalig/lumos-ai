package semantics

import (
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
)

func TestEvidenceContextIncludesAdjacentPreviousTurn(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     1,
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     2,
		Text:          "On Monday.",
		CapturedAt: now.Add(
			2 * time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if !context.HasPrevious() {
		t.Fatal(
			"expected adjacent previous turn",
		)
	}

	if context.Previous == nil {
		t.Fatal(
			"expected previous turn",
		)
	}

	if context.Previous.EventID !=
		previous.EventID {

		t.Fatalf(
			"expected previous event %q, got %q",
			previous.EventID,
			context.Previous.EventID,
		)
	}

	if context.Current.EventID !=
		current.EventID {

		t.Fatalf(
			"expected current event %q, got %q",
			current.EventID,
			context.Current.EventID,
		)
	}
}

func TestEvidenceContextWithoutPreviousTurn(
	t *testing.T,
) {
	t.Parallel()

	current := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     0,
		Text:          "We decided to ship version one.",
		CapturedAt:    time.Now().UTC(),
	}

	context :=
		NewEvidenceContext(
			nil,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"did not expect previous turn",
		)
	}

	if context.Previous != nil {
		t.Fatal(
			"previous turn must be nil",
		)
	}

	if context.Current.EventID !=
		current.EventID {

		t.Fatalf(
			"expected current event %q, got %q",
			current.EventID,
			context.Current.EventID,
		)
	}
}

func TestEvidenceContextRejectsDifferentMeeting(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-2",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"different meetings must not share context",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"different meetings must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsDifferentParticipant(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-alex",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-sam",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"different participants must not share context",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"different participants must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsDifferentTrack(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-2",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"different tracks must not share context",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"different tracks must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsGapBeyondMaximum(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			MaxAdjacentTurnGap +
				time.Millisecond,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"context beyond maximum adjacency gap must be rejected",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turns beyond maximum adjacency gap must not be adjacent",
		)
	}
}

func TestEvidenceContextAcceptsExactMaximumGap(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			MaxAdjacentTurnGap,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if !context.HasPrevious() {
		t.Fatal(
			"turn exactly at maximum adjacency gap should be accepted",
		)
	}

	if !AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turns exactly at maximum adjacency gap should be adjacent",
		)
	}
}

func TestEvidenceContextAcceptsTurnOrderReset(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     7,
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",

		// AssemblyAI realtime session may restart
		// and its local turn order may reset to zero.
		TurnOrder: 0,

		Text: "On Monday.",

		CapturedAt: now.Add(
			2 * time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if !context.HasPrevious() {
		t.Fatal(
			"turn order reset must not break otherwise-safe adjacency",
		)
	}

	if !AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn order must not determine evidence adjacency",
		)
	}
}

func TestEvidenceContextRejectsSameEvent(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"an evidence event must not contextualize itself",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"same event ID must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsNegativeTimeGap(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			-time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.HasPrevious() {
		t.Fatal(
			"negative evidence time gap must be rejected",
		)
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"current evidence captured before previous evidence must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsMissingEventID(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn without event ID must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsMissingMeetingID(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn without meeting ID must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsMissingParticipantID(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn without participant ID must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsMissingTrackID(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn without track ID must not be adjacent",
		)
	}
}

func TestEvidenceContextRejectsMissingCapturedAt(
	t *testing.T,
) {
	t.Parallel()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt:    time.Now().UTC(),
	}

	if AreAdjacentTurns(
		previous,
		current,
	) {
		t.Fatal(
			"turn without capturedAt must not be adjacent",
		)
	}
}

func TestEvidenceContextGroundingTextWithoutPrevious(
	t *testing.T,
) {
	t.Parallel()

	current := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "  We decided to ship Friday.  ",
		CapturedAt:    time.Now().UTC(),
	}

	context :=
		NewEvidenceContext(
			nil,
			current,
		)

	got :=
		context.GroundingText()

	want :=
		"We decided to ship Friday."

	if got != want {
		t.Fatalf(
			"expected grounding text %q, got %q",
			want,
			got,
		)
	}
}

func TestEvidenceContextGroundingTextWithPrevious(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "  Alex will prepare the deployment.  ",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "  On Monday.  ",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	got :=
		context.GroundingText()

	want :=
		"Alex will prepare the deployment.  \n  On Monday."

	if got != want {
		t.Fatalf(
			"expected grounding text %q, got %q",
			want,
			got,
		)
	}
}

func TestEvidenceContextCopiesPreviousTurn(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will prepare the deployment.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "On Monday.",
		CapturedAt: now.Add(
			time.Second,
		),
	}

	context :=
		NewEvidenceContext(
			&previous,
			current,
		)

	if context.Previous == nil {
		t.Fatal(
			"expected previous turn",
		)
	}

	previous.Text =
		"mutated outside context"

	if context.Previous.Text !=
		"Alex will prepare the deployment." {

		t.Fatalf(
			"context must hold an independent previous-turn copy, got %q",
			context.Previous.Text,
		)
	}
}

func TestOwnershipRefinementContextAllowsSameParticipantNamedAssignment(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-ownerless",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "We need to ship the pricing page by Friday.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-owner",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "Alex will ship the pricing page.",
		CapturedAt: now.Add(
			20 * time.Second,
		),
	}

	input :=
		NewOwnershipRefinementContext(
			&previous,
			current,
		)

	if !input.HasPrevious() {
		t.Fatal(
			"expected same-participant named ownership assignment to receive previous context",
		)
	}
}

func TestOwnershipRefinementContextRejectsSameParticipantUnrelatedStatement(
	t *testing.T,
) {
	t.Parallel()

	now := time.Now().UTC()

	previous := evidence.Turn{
		EventID:       "event-ownerless",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "We need to ship the pricing page by Friday.",
		CapturedAt:    now,
	}

	current := evidence.Turn{
		EventID:       "event-unrelated",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		Text:          "The staging environment is slow today.",
		CapturedAt: now.Add(
			20 * time.Second,
		),
	}

	input :=
		NewOwnershipRefinementContext(
			&previous,
			current,
		)

	if input.HasPrevious() {
		t.Fatal(
			"unrelated same-participant speech must not receive ownership refinement context",
		)
	}
}

func TestDueDateRefinementContextAcceptsNaturalWeekdaySentence(
	t *testing.T,
) {
	t.Parallel()

	now :=
		time.Now().
			UTC()

	previous :=
		evidence.Turn{
			EventID: "event-previous",

			MeetingID: "meeting-1",

			ParticipantID: "demo:maya",

			TrackID: "track-maya",

			Text: "I can take ownership of the final review.",

			CapturedAt: now,
		}

	current :=
		evidence.Turn{
			EventID: "event-current",

			MeetingID: "meeting-1",

			ParticipantID: "member:user-1",

			TrackID: "track-user",

			Text: "The final review can be completed on Friday.",

			CapturedAt: now.Add(
				10 * time.Second,
			),
		}

	context :=
		NewDueDateRefinementContext(
			&previous,
			current,
		)

	if !context.HasPrevious() {
		t.Fatal(
			"expected natural due-date answer to receive refinement context",
		)
	}
}
