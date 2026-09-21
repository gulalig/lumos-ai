package semantics

import (
	"testing"

	"lumos/realtime-go/internal/evidence"
)

func TestCoverageDetectsMissingDecision(
	t *testing.T,
) {
	t.Parallel()

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     1,
		Text: "We decided to release version 1 on Friday " +
			"and Alex will prepare the deployment by Thursday.",
	}

	candidates := []Candidate{
		{
			Kind:       KindCommitment,
			Summary:    "Alex will prepare the deployment",
			Owner:      "Alex",
			DueText:    "by Thursday",
			Explicit:   true,
			Confidence: 0.9,
		},
	}

	coverage := AnalyzeCoverage(
		candidates,
		turn,
	)

	if !coverage.ExpectsDecision {
		t.Fatal(
			"expected evidence to contain explicit decision signal",
		)
	}

	if coverage.HasDecision {
		t.Fatal(
			"expected decision to be missing",
		)
	}

	if !coverage.HasGap() {
		t.Fatal(
			"expected semantic coverage gap",
		)
	}
}

func TestCoveragePassesWhenDecisionIsPresent(
	t *testing.T,
) {
	t.Parallel()

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     2,
		Text: "We decided to release version 1 on Friday " +
			"and Alex will prepare the deployment by Thursday.",
	}

	candidates := []Candidate{
		{
			Kind:       KindDecision,
			Summary:    "Release version 1 on Friday",
			Explicit:   true,
			Confidence: 0.95,
		},
		{
			Kind:       KindCommitment,
			Summary:    "Alex will prepare the deployment",
			Owner:      "Alex",
			DueText:    "by Thursday",
			Explicit:   true,
			Confidence: 0.9,
		},
	}

	coverage := AnalyzeCoverage(
		candidates,
		turn,
	)

	if !coverage.ExpectsDecision {
		t.Fatal(
			"expected explicit decision signal",
		)
	}

	if !coverage.HasDecision {
		t.Fatal(
			"expected valid decision candidate",
		)
	}

	if coverage.HasGap() {
		t.Fatal(
			"did not expect semantic coverage gap",
		)
	}
}

func TestCoverageDoesNotExpectDecisionWithoutExplicitSignal(
	t *testing.T,
) {
	t.Parallel()

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-3",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     3,
		Text:          "Alex will prepare the deployment by Thursday.",
	}

	candidates := []Candidate{
		{
			Kind:       KindCommitment,
			Summary:    "Alex will prepare the deployment",
			Owner:      "Alex",
			DueText:    "by Thursday",
			Explicit:   true,
			Confidence: 0.9,
		},
	}

	coverage := AnalyzeCoverage(
		candidates,
		turn,
	)

	if coverage.ExpectsDecision {
		t.Fatal(
			"did not expect decision signal",
		)
	}

	if coverage.HasGap() {
		t.Fatal(
			"did not expect coverage gap",
		)
	}
}

func TestCoverageIgnoresUngroundedDecisionCandidate(
	t *testing.T,
) {
	t.Parallel()

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-4",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-1",
		TrackID:       "track-1",
		TurnOrder:     4,
		Text:          "Alex will prepare the deployment by Thursday.",
	}

	candidates := []Candidate{
		{
			Kind:       KindDecision,
			Summary:    "Release version 1 on Friday",
			Explicit:   true,
			Confidence: 1,
		},
	}

	coverage := AnalyzeCoverage(
		candidates,
		turn,
	)

	if coverage.HasDecision {
		t.Fatal(
			"ungrounded decision must not count toward coverage",
		)
	}
}
