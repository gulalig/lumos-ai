package meetingactor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetingstate"
	"lumos/realtime-go/internal/semantics"
)

// Deliberately model the live extractor's failures: ownership restatements
// arrive as new commitments; short date fragments arrive as unknown.
type liveContinuityExtractor struct{}

func (liveContinuityExtractor) Extract(_ context.Context, turn evidence.Turn) ([]semantics.Candidate, error) {
	if semantics.SameResponsibility(turn.Text, turn.Text) {
		return []semantics.Candidate{{Kind: semantics.KindCommitment, Summary: turn.Text,
			Owner: turn.ParticipantID, Explicit: true, Confidence: .99}}, nil
	}
	return []semantics.Candidate{{Kind: semantics.KindUnknown, Summary: turn.Text, Confidence: .9}}, nil
}
func (e liveContinuityExtractor) ExtractContext(ctx context.Context, input semantics.EvidenceContext) ([]semantics.Candidate, error) {
	return e.Extract(ctx, input.Current)
}

func TestLivePrepareEvidenceContinuityAndCrossSpeakerDeadline(t *testing.T) {
	for _, test := range []struct {
		answer  string
		seconds int
	}{{"On Monday.", 35}, {"By Tuesday.", 35}, {"Wednesday works.", 35}, {"Next Thursday.", 35},
		{"On Friday.", 35}, {"Tomorrow.", 35}, {"By 2026-10-12.", 35}, {"On Monday.", 90}} {
		t.Run(fmt.Sprintf("%s/after_%ds", test.answer, test.seconds), func(t *testing.T) {
			logger := slog.New(slog.NewTextHandler(io.Discard, nil))
			extractor := semantics.NewFallbackExtractor(liveContinuityExtractor{}, liveContinuityExtractor{}, logger)
			actor := New("meeting-live", extractor, logger)
			state, _ := meetingstate.New("meeting-live")
			base := time.Date(2026, 9, 30, 0, 21, 0, 0, time.UTC)
			process := func(speaker, track, text string, seconds int) semantics.Observation {
				t.Helper()
				turn, err := evidence.NewTurn("meeting-live", speaker, track, 0, text, base.Add(time.Duration(seconds)*time.Second))
				if err != nil {
					t.Fatal(err)
				}
				payload, _ := json.Marshal(turn)
				prepared, err := actor.PrepareEvidence(context.Background(), string(payload))
				if err != nil {
					t.Fatal(err)
				}
				for _, observation := range prepared.Observations {
					if _, err := state.Apply(observation); err != nil {
						t.Fatal(err)
					}
				}
				// Exercise durable context encoding/restoration after every turn,
				// including turns that contain no semantic observations.
				checkpoint := prepared.ContextCheckpoint("123-0")
				raw, err := EncodeContextCheckpoint(checkpoint)
				if err != nil {
					t.Fatal(err)
				}
				var restored ContextCheckpoint
				if err := json.Unmarshal([]byte(raw), &restored); err != nil {
					t.Fatal(err)
				}
				actor = New("meeting-live", extractor, logger)
				if err := actor.RestoreContext(restored); err != nil {
					t.Fatal(err)
				}
				if len(prepared.Observations) == 0 {
					return semantics.Observation{}
				}
				if len(prepared.Observations) != 1 {
					t.Fatalf("unexpected observations: %+v", prepared.Observations)
				}
				return prepared.Observations[0]
			}
			first := process("demo:maya", "track-maya-1", "I can also take care of the final review.", 0)
			process("demo:alex", "track-alex", "I think the remaining question is when we want the final review completed.", 7)
			process("demo:maya", "track-maya-2", "That works for me.", 10)
			second := process("demo:maya", "track-maya-2", "Once we agree on the timing, I can take ownership of the final check.", 15)
			if second.SupersedesObservationID != first.ID {
				t.Fatalf("new lineage instead of refinement: %+v", second)
			}
			process("member:user", "track-user", "I think Monday could work.", 20)
			refined := process("member:user", "track-user", test.answer, test.seconds)
			if refined.SupersedesObservationID != second.ID || refined.Owner != "demo:maya" || refined.DueText == "" {
				t.Fatalf("deadline patch lost: %+v", refined)
			}
			if len(state.Commitments) != 1 || state.Commitments[0].DueText != refined.DueText {
				t.Fatalf("projector did not replace commitment: %+v", state.Commitments)
			}
			if len(actor.openCommitments) != 0 {
				t.Fatal("resolved commitment remains open")
			}
			if repeated := process("member:user", "track-user", test.answer, test.seconds+3); repeated.ID != "" {
				t.Fatalf("repeated answer created another observation: %+v", repeated)
			}
		})
	}
}

func TestLiveDifferentCommitmentsRemainDistinctAndDeadlineIsAmbiguous(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	actor := New("meeting-live", liveContinuityExtractor{}, logger)
	base := time.Now().UTC()
	var results []semantics.Observation
	for i, text := range []string{"I can take care of the final review.", "I can take care of the deployment checklist.", "On Monday."} {
		speaker := "demo:maya"
		if i == 2 {
			speaker = "member:user"
		}
		turn, _ := evidence.NewTurn("meeting-live", speaker, "track", i, text, base.Add(time.Duration(i)*time.Second))
		payload, _ := json.Marshal(turn)
		prepared, err := actor.PrepareEvidence(context.Background(), string(payload))
		if err != nil {
			t.Fatal(err)
		}
		actor.commitPrepared(prepared)
		results = append(results, prepared.Observations...)
	}
	if len(results) != 2 || results[1].SupersedesObservationID != "" || len(actor.openCommitments) != 2 {
		t.Fatalf("distinct tasks were collapsed or ambiguous deadline applied: %+v", results)
	}
}
