package meetingactor

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type refinementTestExtractor struct {
	extractCalls        int
	extractContextCalls int
}

type missingOwnerRefinementExtractor struct {
	extractCalls        int
	extractContextCalls int
}

func (
	e *missingOwnerRefinementExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]semantics.Candidate, error) {
	e.extractCalls++

	return []semantics.Candidate{
		{
			Kind: semantics.KindCommitment,

			Summary: "Prepare the deployment checklist",

			Owner: "",

			DueText: "",

			Explicit: true,

			RefinesPrevious: false,

			Confidence: 0.95,
		},
	}, nil
}

func (
	e *missingOwnerRefinementExtractor,
) ExtractContext(
	_ context.Context,
	input semantics.EvidenceContext,
) ([]semantics.Candidate, error) {
	e.extractContextCalls++

	if !input.HasPrevious() {
		return []semantics.Candidate{
			{
				Kind: semantics.KindUnknown,

				Summary: "",

				Owner: "",

				DueText: "",

				Explicit: false,

				RefinesPrevious: false,

				Confidence: 1,
			},
		}, nil
	}

	return []semantics.Candidate{
		{
			Kind: semantics.KindCommitment,

			Summary: "Prepare the deployment checklist",

			Owner: input.Current.ParticipantID,

			DueText: "",

			Explicit: true,

			RefinesPrevious: true,

			Confidence: 0.95,
		},
	}, nil
}

func (
	e *refinementTestExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]semantics.Candidate, error) {
	e.extractCalls++

	return []semantics.Candidate{
		{
			Kind: semantics.KindCommitment,

			Summary: "Alex will prepare his own task",

			Owner: "Alex",

			DueText: "",

			Explicit: true,

			RefinesPrevious: false,

			Confidence: 0.9,
		},
	}, nil
}

func (
	e *refinementTestExtractor,
) ExtractContext(
	_ context.Context,
	input semantics.EvidenceContext,
) ([]semantics.Candidate, error) {
	e.extractContextCalls++

	if !input.HasPrevious() {
		return []semantics.Candidate{
			{
				Kind: semantics.KindUnknown,

				Summary: "",

				Owner: "",

				DueText: "",

				Explicit: false,

				RefinesPrevious: false,

				Confidence: 1,
			},
		}, nil
	}

	return []semantics.Candidate{
		{
			Kind: semantics.KindCommitment,

			Summary: "Alex will prepare his own task",

			Owner: "Alex",

			DueText: "on Monday",

			Explicit: true,

			RefinesPrevious: true,

			Confidence: 0.95,
		},
	}, nil
}

func TestActorRefinesAdjacentCommitment(
	t *testing.T,
) {
	t.Parallel()

	const (
		meetingID = "meeting-1"

		participantID = "participant-alex"

		trackID = "track-1"
	)

	baseTime := time.Date(
		2026,
		time.September,
		19,
		0,
		0,
		0,
		0,
		time.UTC,
	)

	firstTurn, err := evidence.NewTurn(
		meetingID,
		participantID,
		trackID,
		0,
		"Alex will prepare his own task.",
		baseTime,
	)
	if err != nil {
		t.Fatal(err)
	}

	secondTurn, err := evidence.NewTurn(
		meetingID,
		participantID,
		trackID,
		1,
		"on Monday.",
		baseTime.Add(
			2*time.Second,
		),
	)
	if err != nil {
		t.Fatal(err)
	}

	extractor :=
		&refinementTestExtractor{}

	logger := slog.New(
		slog.NewTextHandler(
			io.Discard,
			nil,
		),
	)

	actor := New(
		meetingID,
		extractor,
		logger,
	)

	firstPayload, err :=
		json.Marshal(
			firstTurn,
		)
	if err != nil {
		t.Fatal(err)
	}

	if err := actor.HandleEvidence(
		context.Background(),
		string(firstPayload),
	); err != nil {
		t.Fatalf(
			"handle first evidence: %v",
			err,
		)
	}

	if len(actor.previousObservations) != 1 {
		t.Fatalf(
			"expected one first-turn observation, got %d",
			len(actor.previousObservations),
		)
	}

	firstObservation :=
		actor.previousObservations[0]

	if firstObservation.Kind !=
		semantics.KindCommitment {

		t.Fatalf(
			"expected commitment, got %q",
			firstObservation.Kind,
		)
	}

	if firstObservation.Owner !=
		"Alex" {

		t.Fatalf(
			"expected owner Alex, got %q",
			firstObservation.Owner,
		)
	}

	if firstObservation.DueText !=
		"" {

		t.Fatalf(
			"expected empty initial due text, got %q",
			firstObservation.DueText,
		)
	}

	if firstObservation.SupersedesObservationID !=
		"" {

		t.Fatalf(
			"initial observation must not supersede anything, got %q",
			firstObservation.SupersedesObservationID,
		)
	}

	secondPayload, err :=
		json.Marshal(
			secondTurn,
		)
	if err != nil {
		t.Fatal(err)
	}

	if err := actor.HandleEvidence(
		context.Background(),
		string(secondPayload),
	); err != nil {
		t.Fatalf(
			"handle second evidence: %v",
			err,
		)
	}

	if len(actor.previousObservations) != 1 {
		t.Fatalf(
			"expected one second-turn observation, got %d",
			len(actor.previousObservations),
		)
	}

	secondObservation :=
		actor.previousObservations[0]

	if secondObservation.Kind !=
		semantics.KindCommitment {

		t.Fatalf(
			"expected revised commitment, got %q",
			secondObservation.Kind,
		)
	}

	if secondObservation.Owner !=
		"Alex" {

		t.Fatalf(
			"expected revised owner Alex, got %q",
			secondObservation.Owner,
		)
	}

	if secondObservation.DueText !=
		"on Monday" {

		t.Fatalf(
			"expected due text %q, got %q",
			"on Monday",
			secondObservation.DueText,
		)
	}

	if secondObservation.SupersedesObservationID !=
		firstObservation.ID {

		t.Fatalf(
			"expected revised observation to supersede %q, got %q",
			firstObservation.ID,
			secondObservation.SupersedesObservationID,
		)
	}

	if len(
		secondObservation.SupportingEvidenceEventIDs,
	) != 2 {
		t.Fatalf(
			"expected 2 supporting evidence events, got %d",
			len(
				secondObservation.SupportingEvidenceEventIDs,
			),
		)
	}

	if secondObservation.SupportingEvidenceEventIDs[0] !=
		firstTurn.EventID {

		t.Fatalf(
			"expected first supporting event %q, got %q",
			firstTurn.EventID,
			secondObservation.SupportingEvidenceEventIDs[0],
		)
	}

	if secondObservation.SupportingEvidenceEventIDs[1] !=
		secondTurn.EventID {

		t.Fatalf(
			"expected second supporting event %q, got %q",
			secondTurn.EventID,
			secondObservation.SupportingEvidenceEventIDs[1],
		)
	}

	if extractor.extractCalls != 1 {
		t.Fatalf(
			"expected normal Extract to run once, got %d",
			extractor.extractCalls,
		)
	}

	if extractor.extractContextCalls != 1 {
		t.Fatalf(
			"expected contextual ExtractContext to run once, got %d",
			extractor.extractContextCalls,
		)
	}
}

func TestActorRefinesCommitmentByAddingMissingOwner(
	t *testing.T,
) {
	t.Parallel()

	const (
		meetingID     = "meeting-owner-refinement"
		participantID = "participant-alex"
		trackID       = "track-1"
	)

	baseTime := time.Date(
		2026,
		time.September,
		24,
		0,
		0,
		0,
		0,
		time.UTC,
	)

	firstTurn, err := evidence.NewTurn(
		meetingID,
		participantID,
		trackID,
		0,
		"Prepare the deployment checklist.",
		baseTime,
	)
	if err != nil {
		t.Fatal(err)
	}

	secondTurn, err := evidence.NewTurn(
		meetingID,
		participantID,
		trackID,
		1,
		"I'll own it.",
		baseTime.Add(
			2*time.Second,
		),
	)
	if err != nil {
		t.Fatal(err)
	}

	extractor :=
		&missingOwnerRefinementExtractor{}

	logger := slog.New(
		slog.NewTextHandler(
			io.Discard,
			nil,
		),
	)

	actor := New(
		meetingID,
		extractor,
		logger,
	)

	firstPayload, err :=
		json.Marshal(
			firstTurn,
		)
	if err != nil {
		t.Fatal(err)
	}

	if err := actor.HandleEvidence(
		context.Background(),
		string(firstPayload),
	); err != nil {
		t.Fatalf(
			"handle first evidence: %v",
			err,
		)
	}

	if len(actor.previousObservations) != 1 {
		t.Fatalf(
			"expected one initial observation, got %d",
			len(actor.previousObservations),
		)
	}

	firstObservation :=
		actor.previousObservations[0]

	if firstObservation.Kind !=
		semantics.KindCommitment {

		t.Fatalf(
			"expected initial commitment, got %q",
			firstObservation.Kind,
		)
	}

	if firstObservation.Owner != "" {
		t.Fatalf(
			"expected initial owner to be empty, got %q",
			firstObservation.Owner,
		)
	}

	if firstObservation.SupersedesObservationID != "" {
		t.Fatalf(
			"initial observation must not supersede anything, got %q",
			firstObservation.SupersedesObservationID,
		)
	}

	secondPayload, err :=
		json.Marshal(
			secondTurn,
		)
	if err != nil {
		t.Fatal(err)
	}

	if err := actor.HandleEvidence(
		context.Background(),
		string(secondPayload),
	); err != nil {
		t.Fatalf(
			"handle second evidence: %v",
			err,
		)
	}

	if len(actor.previousObservations) != 1 {
		t.Fatalf(
			"expected one refined observation, got %d",
			len(actor.previousObservations),
		)
	}

	secondObservation :=
		actor.previousObservations[0]

	if secondObservation.Kind !=
		semantics.KindCommitment {

		t.Fatalf(
			"expected refined commitment, got %q",
			secondObservation.Kind,
		)
	}

	if secondObservation.Owner !=
		participantID {

		t.Fatalf(
			"expected refined owner %q, got %q",
			participantID,
			secondObservation.Owner,
		)
	}

	if secondObservation.SupersedesObservationID !=
		firstObservation.ID {

		t.Fatalf(
			"expected refined observation to supersede %q, got %q",
			firstObservation.ID,
			secondObservation.SupersedesObservationID,
		)
	}

	if len(
		secondObservation.SupportingEvidenceEventIDs,
	) != 2 {
		t.Fatalf(
			"expected 2 supporting evidence events, got %d",
			len(
				secondObservation.SupportingEvidenceEventIDs,
			),
		)
	}

	if secondObservation.SupportingEvidenceEventIDs[0] !=
		firstTurn.EventID {

		t.Fatalf(
			"expected first supporting event %q, got %q",
			firstTurn.EventID,
			secondObservation.SupportingEvidenceEventIDs[0],
		)
	}

	if secondObservation.SupportingEvidenceEventIDs[1] !=
		secondTurn.EventID {

		t.Fatalf(
			"expected second supporting event %q, got %q",
			secondTurn.EventID,
			secondObservation.SupportingEvidenceEventIDs[1],
		)
	}

	if extractor.extractCalls != 1 {
		t.Fatalf(
			"expected normal Extract to run once, got %d",
			extractor.extractCalls,
		)
	}

	if extractor.extractContextCalls != 1 {
		t.Fatalf(
			"expected contextual ExtractContext to run once, got %d",
			extractor.extractContextCalls,
		)
	}
}

func TestActorAllowsDifferentParticipantToClaimOwnerlessCommitment(
	t *testing.T,
) {
	t.Parallel()

	const (
		meetingID = "meeting-cross-speaker-owner"

		firstParticipantID = "participant-alice"

		secondParticipantID = "participant-bob"

		firstTrackID = "track-alice"

		secondTrackID = "track-bob"
	)

	baseTime := time.Date(
		2026,
		time.September,
		24,
		0,
		0,
		0,
		0,
		time.UTC,
	)

	firstTurn, err :=
		evidence.NewTurn(
			meetingID,
			firstParticipantID,
			firstTrackID,
			0,
			"Prepare the deployment checklist.",
			baseTime,
		)

	if err != nil {
		t.Fatal(err)
	}

	secondTurn, err :=
		evidence.NewTurn(
			meetingID,
			secondParticipantID,
			secondTrackID,
			0,
			"I'll own it.",
			baseTime.Add(
				3*time.Second,
			),
		)

	if err != nil {
		t.Fatal(err)
	}

	extractor :=
		&missingOwnerRefinementExtractor{}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	actor :=
		New(
			meetingID,
			extractor,
			logger,
		)

	firstPayload, err :=
		json.Marshal(
			firstTurn,
		)

	if err != nil {
		t.Fatal(err)
	}

	if err :=
		actor.HandleEvidence(
			context.Background(),
			string(firstPayload),
		); err != nil {

		t.Fatalf(
			"handle first evidence: %v",
			err,
		)
	}

	if len(
		actor.previousObservations,
	) != 1 {

		t.Fatalf(
			"expected one initial observation, got %d",
			len(
				actor.previousObservations,
			),
		)
	}

	firstObservation :=
		actor.previousObservations[0]

	if firstObservation.Owner != "" {
		t.Fatalf(
			"expected initial owner to be empty, got %q",
			firstObservation.Owner,
		)
	}

	secondPayload, err :=
		json.Marshal(
			secondTurn,
		)

	if err != nil {
		t.Fatal(err)
	}

	if err :=
		actor.HandleEvidence(
			context.Background(),
			string(secondPayload),
		); err != nil {

		t.Fatalf(
			"handle second evidence: %v",
			err,
		)
	}

	if len(
		actor.previousObservations,
	) != 1 {

		t.Fatalf(
			"expected one refined observation, got %d",
			len(
				actor.previousObservations,
			),
		)
	}

	refined :=
		actor.previousObservations[0]

	if refined.Owner !=
		secondParticipantID {

		t.Fatalf(
			"expected second participant %q to become owner, got %q",
			secondParticipantID,
			refined.Owner,
		)
	}

	if refined.SupersedesObservationID !=
		firstObservation.ID {

		t.Fatalf(
			"expected refinement to supersede %q, got %q",
			firstObservation.ID,
			refined.SupersedesObservationID,
		)
	}

	if len(
		refined.SupportingEvidenceEventIDs,
	) != 2 {

		t.Fatalf(
			"expected 2 supporting evidence events, got %d",
			len(
				refined.SupportingEvidenceEventIDs,
			),
		)
	}

	if refined.SupportingEvidenceEventIDs[0] !=
		firstTurn.EventID {

		t.Fatalf(
			"expected first evidence %q, got %q",
			firstTurn.EventID,
			refined.SupportingEvidenceEventIDs[0],
		)
	}

	if refined.SupportingEvidenceEventIDs[1] !=
		secondTurn.EventID {

		t.Fatalf(
			"expected second evidence %q, got %q",
			secondTurn.EventID,
			refined.SupportingEvidenceEventIDs[1],
		)
	}
}

func TestActorDoesNotShareContextForUnrelatedDifferentParticipant(
	t *testing.T,
) {
	t.Parallel()

	const (
		meetingID = "meeting-cross-speaker-unrelated"

		firstParticipantID = "participant-alice"

		secondParticipantID = "participant-bob"

		firstTrackID = "track-alice"

		secondTrackID = "track-bob"
	)

	baseTime := time.Date(
		2026,
		time.September,
		24,
		0,
		0,
		0,
		0,
		time.UTC,
	)

	firstTurn, err :=
		evidence.NewTurn(
			meetingID,
			firstParticipantID,
			firstTrackID,
			0,
			"Prepare the deployment checklist.",
			baseTime,
		)

	if err != nil {
		t.Fatal(err)
	}

	secondTurn, err :=
		evidence.NewTurn(
			meetingID,
			secondParticipantID,
			secondTrackID,
			0,
			"The staging environment looks slow.",
			baseTime.Add(
				3*time.Second,
			),
		)

	if err != nil {
		t.Fatal(err)
	}

	input :=
		semantics.NewOwnershipRefinementContext(
			&firstTurn,
			secondTurn,
		)

	if input.HasPrevious() {
		t.Fatal(
			"unrelated cross-speaker turn must not receive previous context",
		)
	}
}
