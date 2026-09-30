package meetingactor

import (
	"testing"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

func TestFindSupersededObservationAllowsLikelyOwnerTranscriptionCorrection(
	t *testing.T,
) {
	previousTurn :=
		evidence.Turn{
			EventID: "event-1",
		}

	actor :=
		&Actor{
			previousObservations: []semantics.Observation{
				{
					ID: "observation-1",

					Kind: semantics.KindCommitment,

					EvidenceEventID: previousTurn.EventID,

					Owner: "Lumas Developer",
				},
			},
		}

	candidate :=
		semantics.Candidate{
			Kind: semantics.KindCommitment,

			Owner: "Lumos Developer",
		}

	input :=
		semantics.EvidenceContext{
			Previous: &previousTurn,
		}

	got :=
		actor.findSupersededObservation(
			candidate,
			input,
		)

	if got !=
		"observation-1" {

		t.Fatalf(
			"expected transcription correction to supersede %q, got %q",
			"observation-1",
			got,
		)
	}
}

func TestFindSupersededObservationRejectsDifferentExistingOwner(
	t *testing.T,
) {
	previousTurn :=
		evidence.Turn{
			EventID: "event-1",
		}

	actor :=
		&Actor{
			previousObservations: []semantics.Observation{
				{
					ID: "observation-1",

					Kind: semantics.KindCommitment,

					EvidenceEventID: previousTurn.EventID,

					Owner: "Lumos Developer",
				},
			},
		}

	candidate :=
		semantics.Candidate{
			Kind: semantics.KindCommitment,

			Owner: "Sam Developer",
		}

	input :=
		semantics.EvidenceContext{
			Previous: &previousTurn,
		}

	got :=
		actor.findSupersededObservation(
			candidate,
			input,
		)

	if got != "" {
		t.Fatalf(
			"expected different owner to be rejected, got superseded observation %q",
			got,
		)
	}
}

func TestLikelyOwnerTranscriptionCorrectionRejectsShortNames(
	t *testing.T,
) {
	if likelyOwnerTranscriptionCorrection(
		"Alex",
		"Alec",
	) {
		t.Fatal(
			"short similar names must not be fuzzy-merged",
		)
	}
}
