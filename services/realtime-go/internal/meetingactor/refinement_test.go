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

func (e *refinementTestExtractor) Extract(
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

func (e *refinementTestExtractor) ExtractContext(
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
