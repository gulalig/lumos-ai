package semantics

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
)

type stubExtractor struct {
	candidates []Candidate
	err        error
	calls      int
}

func (s *stubExtractor) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]Candidate, error) {
	s.calls++

	if s.err != nil {
		return nil, s.err
	}

	return s.candidates, nil
}

func TestFallbackExtractorUsesPrimaryWhenResultIsValid(
	t *testing.T,
) {
	t.Parallel()

	primary := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindProposal,
				Summary:    "Deploy the app on Friday",
				DueText:    "Friday",
				Explicit:   true,
				Confidence: 0.9,
			},
		},
	}

	fallback := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindUnknown,
				Summary:    "Fallback result",
				Explicit:   true,
				Confidence: 0.5,
			},
		},
	}

	extractor := NewFallbackExtractor(
		primary,
		fallback,
		testLogger(),
	)

	result, err := extractor.Extract(
		context.Background(),
		testTurn(
			"Today our plan is to deploy the app on Friday.",
		),
	)
	if err != nil {
		t.Fatalf(
			"expected no error, got %v",
			err,
		)
	}

	if primary.calls != 1 {
		t.Fatalf(
			"expected primary to be called once, got %d",
			primary.calls,
		)
	}

	if fallback.calls != 0 {
		t.Fatalf(
			"expected fallback not to be called, got %d calls",
			fallback.calls,
		)
	}

	if len(result) != 1 {
		t.Fatalf(
			"expected 1 candidate, got %d",
			len(result),
		)
	}

	if result[0].Kind != KindProposal {
		t.Fatalf(
			"expected proposal, got %q",
			result[0].Kind,
		)
	}
}

func TestFallbackExtractorUsesFallbackWhenPrimaryReturnsOnlyUnknown(
	t *testing.T,
) {
	t.Parallel()

	primary := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindUnknown,
				Summary:    "No clear semantic observation",
				Explicit:   true,
				Confidence: 0.5,
			},
		},
	}

	fallback := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindProposal,
				Summary:    "Take action",
				Explicit:   true,
				Confidence: 0.8,
			},
		},
	}

	extractor := NewFallbackExtractor(
		primary,
		fallback,
		testLogger(),
	)

	result, err := extractor.Extract(
		context.Background(),
		testTurn(
			"Let's do this.",
		),
	)
	if err != nil {
		t.Fatalf(
			"expected no error, got %v",
			err,
		)
	}

	if primary.calls != 1 {
		t.Fatalf(
			"expected primary to be called once, got %d",
			primary.calls,
		)
	}

	if fallback.calls != 1 {
		t.Fatalf(
			"expected fallback to be called once, got %d",
			fallback.calls,
		)
	}

	if len(result) != 1 {
		t.Fatalf(
			"expected 1 fallback candidate, got %d",
			len(result),
		)
	}

	if result[0].Kind != KindProposal {
		t.Fatalf(
			"expected fallback proposal, got %q",
			result[0].Kind,
		)
	}
}

func TestFallbackExtractorUsesFallbackWhenPrimaryFails(
	t *testing.T,
) {
	t.Parallel()

	primary := &stubExtractor{
		err: errors.New(
			"primary provider unavailable",
		),
	}

	fallback := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindQuestion,
				Summary:    "When should we deploy?",
				Explicit:   true,
				Confidence: 0.9,
			},
		},
	}

	extractor := NewFallbackExtractor(
		primary,
		fallback,
		testLogger(),
	)

	result, err := extractor.Extract(
		context.Background(),
		testTurn(
			"When should we deploy?",
		),
	)
	if err != nil {
		t.Fatalf(
			"expected fallback success, got %v",
			err,
		)
	}

	if primary.calls != 1 {
		t.Fatalf(
			"expected primary to be called once, got %d",
			primary.calls,
		)
	}

	if fallback.calls != 1 {
		t.Fatalf(
			"expected fallback to be called once, got %d",
			fallback.calls,
		)
	}

	if len(result) != 1 {
		t.Fatalf(
			"expected 1 candidate, got %d",
			len(result),
		)
	}

	if result[0].Kind != KindQuestion {
		t.Fatalf(
			"expected question, got %q",
			result[0].Kind,
		)
	}
}

func TestFallbackExtractorUsesFallbackWhenPrimaryReturnsNoCandidates(
	t *testing.T,
) {
	t.Parallel()

	primary := &stubExtractor{
		candidates: nil,
	}

	fallback := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindUnknown,
				Summary:    "No supported semantic observation",
				Explicit:   true,
				Confidence: 0.5,
			},
		},
	}

	extractor := NewFallbackExtractor(
		primary,
		fallback,
		testLogger(),
	)

	_, err := extractor.Extract(
		context.Background(),
		testTurn(
			"Some ambiguous statement.",
		),
	)
	if err != nil {
		t.Fatalf(
			"expected no error, got %v",
			err,
		)
	}

	if fallback.calls != 1 {
		t.Fatalf(
			"expected fallback to be called once, got %d",
			fallback.calls,
		)
	}
}

func TestFallbackExtractorUsesFallbackWhenDecisionCoverageIsMissing(
	t *testing.T,
) {
	t.Parallel()

	primary := &stubExtractor{
		candidates: []Candidate{
			{
				Kind:       KindCommitment,
				Summary:    "Alex will prepare the deployment",
				Owner:      "Alex",
				DueText:    "by Thursday",
				Explicit:   true,
				Confidence: 0.9,
			},
		},
	}

	fallback := &stubExtractor{
		candidates: []Candidate{
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
				Confidence: 0.95,
			},
		},
	}

	extractor := NewFallbackExtractor(
		primary,
		fallback,
		testLogger(),
	)

	result, err := extractor.Extract(
		context.Background(),
		testTurn(
			"We decided to release version 1 on Friday "+
				"and Alex will prepare the deployment by Thursday.",
		),
	)
	if err != nil {
		t.Fatalf(
			"expected no error, got %v",
			err,
		)
	}

	if primary.calls != 1 {
		t.Fatalf(
			"expected primary once, got %d",
			primary.calls,
		)
	}

	if fallback.calls != 1 {
		t.Fatalf(
			"expected fallback once due to missing decision coverage, got %d",
			fallback.calls,
		)
	}

	if len(result) != 2 {
		t.Fatalf(
			"expected merged result with 2 candidates, got %d",
			len(result),
		)
	}

	decisionCount := 0
	commitmentCount := 0

	for _, candidate := range result {
		switch candidate.Kind {
		case KindDecision:
			decisionCount++

		case KindCommitment:
			commitmentCount++
		}
	}

	if decisionCount != 1 {
		t.Fatalf(
			"expected exactly 1 decision, got %d",
			decisionCount,
		)
	}

	if commitmentCount != 1 {
		t.Fatalf(
			"expected exactly 1 commitment, got %d",
			commitmentCount,
		)
	}
}

func TestFallbackMergeKeepsPrimaryCommitmentAndAddsMissingDecision(
	t *testing.T,
) {
	t.Parallel()

	turn := testTurn(
		"We decided to release version 1 on Friday " +
			"and Alex will prepare the deployment by Thursday.",
	)

	primary := []Candidate{
		{
			Kind:       KindCommitment,
			Summary:    "Alex will prepare the deployment",
			Owner:      "Alex",
			DueText:    "by Thursday",
			Explicit:   true,
			Confidence: 0.9,
		},
	}

	fallback := []Candidate{
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
			Confidence: 0.95,
		},
	}

	result := mergeCoverageCandidates(
		primary,
		fallback,
		turn,
	)

	if len(result) != 2 {
		t.Fatalf(
			"expected 2 merged candidates, got %d",
			len(result),
		)
	}

	if result[0].Kind != KindCommitment {
		t.Fatalf(
			"expected primary commitment to be preserved, got %q",
			result[0].Kind,
		)
	}

	if result[1].Kind != KindDecision {
		t.Fatalf(
			"expected fallback decision to be appended, got %q",
			result[1].Kind,
		)
	}
}

func testTurn(
	text string,
) evidence.Turn {
	return evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "test-event-id",
		MeetingID:     "test-meeting",
		ParticipantID: "test-participant",
		TrackID:       "test-track",
		TurnOrder:     1,
		Text:          text,
		CapturedAt:    time.Now().UTC(),
	}
}

func testLogger() *slog.Logger {
	return slog.New(
		slog.NewTextHandler(
			io.Discard,
			nil,
		),
	)
}
