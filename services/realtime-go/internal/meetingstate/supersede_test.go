package meetingstate

import (
	"errors"
	"testing"

	"lumos/realtime-go/internal/semantics"
)

func TestStateSupersedesCommitment(
	t *testing.T,
) {
	t.Parallel()

	state, err :=
		New(
			"meeting-1",
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	initial, err :=
		semantics.NewObservation(
			semantics.KindCommitment,
			"event-1",
			"Alex will prepare his own task.",
			"Alex will prepare his own task",
			"Alex",
			"",
			true,
			0.9,
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	changed, err :=
		state.Apply(
			initial,
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	if !changed {
		t.Fatal(
			"expected initial commitment to change state",
		)
	}

	revised, err :=
		semantics.NewObservationWithContext(
			semantics.KindCommitment,
			"event-2",
			[]string{
				"event-1",
				"event-2",
			},
			"Alex will prepare his own task.\non Monday.",
			"Alex will prepare his own task",
			"Alex",
			"on Monday",
			true,
			0.95,
			initial.ID,
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	changed, err =
		state.Apply(
			revised,
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	if !changed {
		t.Fatal(
			"expected revised commitment to change state",
		)
	}

	if state.Version != 2 {
		t.Fatalf(
			"expected version 2, got %d",
			state.Version,
		)
	}

	if len(
		state.Commitments,
	) != 1 {
		t.Fatalf(
			"expected exactly 1 current commitment, got %d",
			len(
				state.Commitments,
			),
		)
	}

	current :=
		state.Commitments[0]

	if current.ID !=
		revised.ID {

		t.Fatalf(
			"expected revised commitment %q, got %q",
			revised.ID,
			current.ID,
		)
	}

	if current.DueText !=
		"on Monday" {

		t.Fatalf(
			"expected due text %q, got %q",
			"on Monday",
			current.DueText,
		)
	}

	if current.SupersedesObservationID !=
		initial.ID {

		t.Fatalf(
			"expected supersedes id %q, got %q",
			initial.ID,
			current.SupersedesObservationID,
		)
	}
}

func TestStateRejectsMissingSupersededObservation(
	t *testing.T,
) {
	t.Parallel()

	state, err :=
		New(
			"meeting-1",
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	observation, err :=
		semantics.NewObservationWithContext(
			semantics.KindCommitment,
			"event-2",
			[]string{
				"event-1",
				"event-2",
			},
			"Alex will prepare the task.\non Monday.",
			"Alex will prepare the task",
			"Alex",
			"on Monday",
			true,
			0.95,
			"missing-observation",
		)

	if err != nil {
		t.Fatal(
			err,
		)
	}

	changed, err :=
		state.Apply(
			observation,
		)

	if changed {
		t.Fatal(
			"invalid revision must not change state",
		)
	}

	if !errors.Is(
		err,
		ErrSupersededObservationNotFound,
	) {
		t.Fatalf(
			"expected ErrSupersededObservationNotFound, got %v",
			err,
		)
	}
}
