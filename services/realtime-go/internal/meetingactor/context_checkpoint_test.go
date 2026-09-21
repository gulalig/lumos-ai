package meetingactor

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

func TestContextCheckpointValidates(
	t *testing.T,
) {
	t.Parallel()

	turn, err := evidence.NewTurn(
		"meeting-1",
		"participant-1",
		"track-1",
		4,
		"Alex will prepare the deployment.",
		time.Now().UTC(),
	)
	if err != nil {
		t.Fatal(err)
	}

	observation, err := semantics.NewObservation(
		semantics.KindCommitment,
		turn.EventID,
		turn.Text,
		"Alex will prepare the deployment",
		"Alex",
		"",
		true,
		0.9,
	)
	if err != nil {
		t.Fatal(err)
	}

	checkpoint := ContextCheckpoint{
		SchemaVersion: ContextCheckpointSchemaVersion,

		MeetingID: "meeting-1",

		EvidenceStreamID: "123-0",

		Turn: turn,

		Observations: []semantics.Observation{
			observation,
		},
	}

	if err := checkpoint.Validate(); err != nil {
		t.Fatalf(
			"expected valid checkpoint, got %v",
			err,
		)
	}

	encoded, err := EncodeContextCheckpoint(
		checkpoint,
	)
	if err != nil {
		t.Fatal(err)
	}

	if encoded == "" {
		t.Fatal(
			"expected encoded checkpoint",
		)
	}
}

func TestContextCheckpointRejectsMeetingMismatch(
	t *testing.T,
) {
	t.Parallel()

	turn := evidence.Turn{
		SchemaVersion: evidence.SchemaVersion,

		EventID: "event-1",

		MeetingID: "meeting-other",

		ParticipantID: "participant-1",

		TrackID: "track-1",

		Text: "Alex will prepare the deployment.",

		CapturedAt: time.Now().UTC(),
	}

	checkpoint := ContextCheckpoint{
		SchemaVersion: ContextCheckpointSchemaVersion,

		MeetingID: "meeting-1",

		EvidenceStreamID: "123-0",

		Turn: turn,
	}

	if err := checkpoint.Validate(); err == nil {
		t.Fatal(
			"expected meeting mismatch to fail validation",
		)
	}
}

func TestActorRestoresContextCheckpoint(
	t *testing.T,
) {
	t.Parallel()

	turn, err := evidence.NewTurn(
		"meeting-1",
		"participant-1",
		"track-1",
		7,
		"Alex will prepare the task.",
		time.Now().UTC(),
	)
	if err != nil {
		t.Fatal(err)
	}

	observation, err := semantics.NewObservation(
		semantics.KindCommitment,
		turn.EventID,
		turn.Text,
		"Alex will prepare the task",
		"Alex",
		"",
		true,
		0.9,
	)
	if err != nil {
		t.Fatal(err)
	}

	checkpoint := ContextCheckpoint{
		SchemaVersion: ContextCheckpointSchemaVersion,

		MeetingID: "meeting-1",

		EvidenceStreamID: "100-0",

		Turn: turn,

		Observations: []semantics.Observation{
			observation,
		},
	}

	actor := &Actor{
		meetingID: "meeting-1",

		logger: slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		),
	}

	if err := actor.RestoreContext(
		checkpoint,
	); err != nil {
		t.Fatal(err)
	}

	if actor.previousTurn == nil {
		t.Fatal(
			"expected previous turn to be restored",
		)
	}

	if actor.previousTurn.EventID !=
		turn.EventID {

		t.Fatalf(
			"expected restored event %q, got %q",
			turn.EventID,
			actor.previousTurn.EventID,
		)
	}

	if len(
		actor.previousObservations,
	) != 1 {
		t.Fatalf(
			"expected 1 restored observation, got %d",
			len(
				actor.previousObservations,
			),
		)
	}

	if actor.previousObservations[0].ID !=
		observation.ID {

		t.Fatalf(
			"expected observation %q, got %q",
			observation.ID,
			actor.previousObservations[0].ID,
		)
	}
}
