package meetingactor

import (
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

func TestActorPreservesOwnerWhenDueDateRefinesCommitment(
	t *testing.T,
) {
	t.Parallel()

	const (
		meetingID = "meeting-1"

		participantID = "member:33333333-3333-4333-8333-333333333333"

		trackID = "track-1"
	)

	baseTime :=
		time.Now().UTC()

	previousTurn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "event-owner",

			MeetingID: meetingID,

			ParticipantID: participantID,

			TrackID: trackID,

			TurnOrder: 1,

			Text: "Lumos developer will ship the pricing page.",

			CapturedAt: baseTime,
		}

	currentTurn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "event-due",

			MeetingID: meetingID,

			ParticipantID: participantID,

			TrackID: trackID,

			TurnOrder: 2,

			Text: "On Friday.",

			CapturedAt: baseTime.Add(
				10 * time.Second,
			),
		}

	actor :=
		&Actor{
			meetingID: meetingID,

			previousTurn: &previousTurn,

			previousObservations: []semantics.Observation{
				{
					ID: "observation-owner",

					Kind: semantics.KindCommitment,

					EvidenceEventID: previousTurn.EventID,

					EvidenceText: previousTurn.Text,

					Summary: "Lumos developer will ship the pricing page.",

					Owner: "Lumos developer",

					DueText: "",

					Explicit: true,

					Confidence: 1,
				},
			},
		}

	input :=
		semantics.NewDueDateRefinementContext(
			&previousTurn,
			currentTurn,
		)

	if !input.HasPrevious() {
		t.Fatal(
			"expected due-date refinement context",
		)
	}

	candidate :=
		semantics.Candidate{
			Kind: semantics.KindCommitment,

			Summary: "Lumos developer will ship the pricing page by Friday.",

			Owner: "",

			DueText: "Friday",

			Explicit: true,

			RefinesPrevious: true,

			Confidence: 1,
		}

	observation,
		ok,
		err :=
		actor.buildObservation(
			candidate,
			input,
		)

	if err != nil {
		t.Fatalf(
			"build observation: %v",
			err,
		)
	}

	if !ok {
		t.Fatal(
			"expected refinement observation",
		)
	}

	if observation.Owner !=
		"Lumos developer" {

		t.Fatalf(
			"expected preserved owner %q, got %q",
			"Lumos developer",
			observation.Owner,
		)
	}

	if observation.DueText !=
		"Friday" {

		t.Fatalf(
			"expected due date %q, got %q",
			"Friday",
			observation.DueText,
		)
	}

	if observation.SupersedesObservationID !=
		"observation-owner" {

		t.Fatalf(
			"expected supersedes %q, got %q",
			"observation-owner",
			observation.SupersedesObservationID,
		)
	}
}

func TestActorPreservesDueDateWhenOwnerRefinesCommitment(
	t *testing.T,
) {
	t.Parallel()

	previousTurn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "event-previous",

			MeetingID: "meeting-1",

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "We need to ship the pricing page by Friday.",

			CapturedAt: time.Now().UTC(),
		}

	currentTurn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "event-current",

			MeetingID: "meeting-1",

			ParticipantID: "participant-alex",

			TrackID: "track-1",

			TurnOrder: 2,

			Text: "Lumos developer will ship the pricing page.",

			CapturedAt: previousTurn.CapturedAt.Add(
				time.Second,
			),
		}

	actor :=
		&Actor{
			previousTurn: &previousTurn,

			previousObservations: []semantics.Observation{
				{
					ID: "observation-previous",

					Kind: semantics.KindCommitment,

					EvidenceEventID: previousTurn.EventID,

					EvidenceText: previousTurn.Text,

					Summary: "We need to ship the pricing page by Friday.",

					Owner: "",

					DueText: "by Friday",

					Explicit: true,

					Confidence: 1,
				},
			},
		}

	input :=
		semantics.EvidenceContext{
			Previous: &previousTurn,

			Current: currentTurn,
		}

	candidate :=
		semantics.Candidate{
			Kind: semantics.KindCommitment,

			Summary: "Lumos developer will ship the pricing page.",

			Owner: "Lumos developer",

			DueText: "",

			Explicit: true,

			RefinesPrevious: true,

			Confidence: 1,
		}

	result :=
		actor.preserveCommitmentRefinementFields(
			candidate,
			input,
		)

	if result.Owner !=
		"Lumos developer" {

		t.Fatalf(
			"expected current owner to remain, got %q",
			result.Owner,
		)
	}

	if result.DueText !=
		"by Friday" {

		t.Fatalf(
			"expected previous due date to be preserved, got %q",
			result.DueText,
		)
	}
}
