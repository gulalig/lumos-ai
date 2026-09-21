package semantics

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"lumos/realtime-go/internal/evidence"
)

type speakerFallbackTestExtractor struct {
	candidates []Candidate
	calls      int
}

func (e *speakerFallbackTestExtractor) Extract(
	_ context.Context,
	_ evidence.Turn,
) ([]Candidate, error) {
	e.calls++

	return append(
		[]Candidate(nil),
		e.candidates...,
	), nil
}

func TestFallbackAcceptsFirstPersonSpeakerCommitment(
	t *testing.T,
) {
	t.Parallel()

	primary :=
		&speakerFallbackTestExtractor{
			candidates: []Candidate{
				{
					Kind: KindCommitment,

					Summary: "Speaker will send the final report by Friday",

					Owner: "I",

					DueText: "Friday",

					Explicit: true,

					Confidence: 0.95,
				},
			},
		}

	fallback :=
		&speakerFallbackTestExtractor{
			candidates: []Candidate{
				{
					Kind: KindUnknown,

					Summary: "fallback",

					Confidence: 0.5,
				},
			},
		}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	extractor :=
		NewFallbackExtractor(
			primary,
			fallback,
			logger,
		)

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-123",
		TrackID:       "track-1",
		TurnOrder:     1,

		Text: "I will send the final report by Friday.",
	}

	got, err :=
		extractor.Extract(
			context.Background(),
			turn,
		)

	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 {
		t.Fatalf(
			"expected one primary candidate, got %d",
			len(got),
		)
	}

	if fallback.calls != 0 {
		t.Fatalf(
			"fallback must not run for grounded first-person commitment; calls=%d",
			fallback.calls,
		)
	}
}
