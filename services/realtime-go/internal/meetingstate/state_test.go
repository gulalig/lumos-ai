package meetingstate

import (
	"testing"

	"lumos/realtime-go/internal/semantics"
)

func TestApplyExplicitCommitment(
	t *testing.T,
) {
	t.Parallel()

	state, err := New("meeting_123")
	if err != nil {
		t.Fatal(err)
	}

	observation, err :=
		semantics.NewObservation(
			semantics.KindCommitment,
			"evidence_123",
			"Alex will prepare the deployment.",
			"Prepare the deployment",
			"Alex",
			"",
			true,
			0.98,
		)
	if err != nil {
		t.Fatal(err)
	}

	changed, err := state.Apply(
		observation,
	)
	if err != nil {
		t.Fatal(err)
	}

	if !changed {
		t.Fatal(
			"expected state to change",
		)
	}

	if len(state.Commitments) != 1 {
		t.Fatalf(
			"expected 1 commitment, got %d",
			len(state.Commitments),
		)
	}

	if state.Version != 1 {
		t.Fatalf(
			"expected version 1, got %d",
			state.Version,
		)
	}
}

func TestRejectImplicitCommitment(
	t *testing.T,
) {
	t.Parallel()

	_, err := semantics.NewObservation(
		semantics.KindCommitment,
		"evidence_123",
		"Alex may prepare the deployment.",
		"Prepare the deployment",
		"Alex",
		"",
		false,
		0.72,
	)

	if err != semantics.ErrImplicitCommitment {
		t.Fatalf(
			"expected ErrImplicitCommitment, got %v",
			err,
		)
	}
}

func TestDuplicateObservationIsIdempotent(
	t *testing.T,
) {
	t.Parallel()

	state, err := New("meeting_123")
	if err != nil {
		t.Fatal(err)
	}

	observation, err :=
		semantics.NewObservation(
			semantics.KindDecision,
			"evidence_123",
			"We decided to launch Friday.",
			"Launch Friday",
			"",
			"Friday",
			true,
			0.99,
		)
	if err != nil {
		t.Fatal(err)
	}

	firstChanged, err :=
		state.Apply(observation)
	if err != nil {
		t.Fatal(err)
	}

	secondChanged, err :=
		state.Apply(observation)
	if err != nil {
		t.Fatal(err)
	}

	if !firstChanged {
		t.Fatal(
			"first application should change state",
		)
	}

	if secondChanged {
		t.Fatal(
			"duplicate observation must not change state",
		)
	}

	if state.Version != 1 {
		t.Fatalf(
			"expected version 1, got %d",
			state.Version,
		)
	}
}
