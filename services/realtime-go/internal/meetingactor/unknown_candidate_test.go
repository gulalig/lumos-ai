package meetingactor

import (
	"testing"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

func TestBuildObservationDropsUnknownCandidate(
	t *testing.T,
) {
	t.Parallel()

	actor :=
		&Actor{
			meetingID: "meeting-1",
		}

	input :=
		semantics.EvidenceContext{
			Current: evidence.Turn{
				SchemaVersion: evidence.SchemaVersion,

				EventID: "event-1",

				MeetingID: "meeting-1",

				ParticipantID: "member-1",

				TrackID: "track-1",

				Text: "background noise",
			},
		}

	observation,
		ok,
		err :=
		actor.buildObservation(
			semantics.Candidate{
				Kind: semantics.KindUnknown,

				Confidence: 1,
			},
			input,
		)

	if err != nil {
		t.Fatalf(
			"unexpected error: %v",
			err,
		)
	}

	if ok {
		t.Fatalf(
			"unknown candidate must not become a durable observation: %+v",
			observation,
		)
	}
}
