package meetingactor

import (
	"errors"
	"testing"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

func TestBuildObservationResolvesFirstPersonSpeakerOwner(
	t *testing.T,
) {
	t.Parallel()

	actor := &Actor{
		meetingID: "meeting-1",
	}

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-1",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-123",
		TrackID:       "track-1",
		TurnOrder:     1,

		Text: "I will send the final report by Friday.",
	}

	input :=
		semantics.NewEvidenceContext(
			nil,
			turn,
		)

	candidate := semantics.Candidate{
		Kind: semantics.KindCommitment,

		Summary: "Speaker will send the final report by Friday",

		Owner: "I",

		DueText: "Friday",

		Explicit: true,

		Confidence: 0.95,
	}

	observation, ok, err :=
		actor.buildObservation(
			candidate,
			input,
		)

	if err != nil {
		t.Fatal(err)
	}

	if !ok {
		t.Fatal(
			"expected observation to be accepted",
		)
	}

	if observation.Owner !=
		"participant-123" {

		t.Fatalf(
			"expected participant owner, got %q",
			observation.Owner,
		)
	}
}

func TestBuildObservationRejectsInventedOwnerForFirstPersonEvidence(
	t *testing.T,
) {
	t.Parallel()

	actor := &Actor{
		meetingID: "meeting-1",
	}

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,
		EventID:       "event-2",
		MeetingID:     "meeting-1",
		ParticipantID: "participant-123",
		TrackID:       "track-1",
		TurnOrder:     2,

		Text: "I will send the final report.",
	}

	input :=
		semantics.NewEvidenceContext(
			nil,
			turn,
		)

	candidate := semantics.Candidate{
		Kind: semantics.KindCommitment,

		Summary: "Alex will send the final report",

		Owner: "Alex",

		Explicit: true,

		Confidence: 0.95,
	}

	_, _, err :=
		actor.buildObservation(
			candidate,
			input,
		)

	if !errors.Is(
		err,
		semantics.ErrUngroundedOwner,
	) {
		t.Fatalf(
			"expected ErrUngroundedOwner, got %v",
			err,
		)
	}
}
