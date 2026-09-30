package semantics

import (
	"context"
	"io"
	"log/slog"
	"lumos/realtime-go/internal/evidence"
	"testing"
)

func TestFallbackPreservesPriorSpeakerDeadlineRefinement(t *testing.T) {
	primary := &speakerFallbackTestExtractor{candidates: []Candidate{{Kind: KindCommitment,
		Summary: "Final review", Owner: "demo:maya", DueText: "on Monday", Explicit: true,
		RefinesPrevious: true, Confidence: .99}}}
	fallback := &speakerFallbackTestExtractor{}
	extractor := NewFallbackExtractor(primary, fallback, slog.New(slog.NewTextHandler(io.Discard, nil)))
	prior := Observation{Kind: KindCommitment, Summary: "Final review", Owner: "demo:maya"}
	input := EvidenceContext{Previous: &evidence.Turn{ParticipantID: "demo:maya", Text: "I can take care of the final review."},
		Current: evidence.Turn{EventID: "answer", ParticipantID: "member:user", Text: "On Monday."}, PreviousCommitment: &prior}
	candidates, err := extractor.ExtractContext(context.Background(), input)
	if err != nil || len(candidates) != 1 || fallback.calls != 0 {
		t.Fatalf("valid primary refinement discarded: candidates=%+v fallback=%d err=%v", candidates, fallback.calls, err)
	}
}

func TestDeadlineAnswersRemainBounded(t *testing.T) {
	for _, text := range []string{"I think Monday could work.", "I will deploy a different feature on Monday.", "not Monday", "by mondayish"} {
		if _, ok := DeadlineAnswer(text); ok {
			t.Fatalf("unsafe deadline answer: %q", text)
		}
	}
	if SameResponsibility("I can take care of the final review.", "I can take care of the final review of the database.") {
		t.Fatal("different scope matched")
	}
}
