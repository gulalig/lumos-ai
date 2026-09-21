package semantics

import "testing"

func TestDecisionRequiresExplicitEvidence(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindDecision,
		Summary:    "Release version 1 on Friday",
		Explicit:   true,
		Confidence: 0.9,
	}

	err := ValidateGrounding(
		candidate,
		"to release version 1 on Friday",
	)

	if err != ErrUngroundedDecision {
		t.Fatalf(
			"expected ErrUngroundedDecision, got %v",
			err,
		)
	}
}

func TestExplicitDecisionPassesGrounding(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindDecision,
		Summary:    "Release version 1 on Friday",
		Explicit:   true,
		Confidence: 0.9,
	}

	err := ValidateGrounding(
		candidate,
		"We decided to release version 1 on Friday.",
	)

	if err != nil {
		t.Fatalf(
			"expected grounded decision, got %v",
			err,
		)
	}
}

func TestCommitmentOwnerMustExistInEvidence(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindCommitment,
		Summary:    "Prepare deployment",
		Owner:      "Sarah",
		Explicit:   true,
		Confidence: 0.9,
	}

	err := ValidateGrounding(
		candidate,
		"Alex will prepare the deployment.",
	)

	if err != ErrUngroundedOwner {
		t.Fatalf(
			"expected ErrUngroundedOwner, got %v",
			err,
		)
	}
}

func TestDueTextMustExistInEvidence(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Alex will prepare the deployment",

		Owner: "Alex",

		DueText: "by Monday",

		Explicit: true,

		Confidence: 0.9,
	}

	err := ValidateGrounding(
		candidate,
		"Alex will prepare the deployment.",
	)

	if err != ErrUngroundedDueText {
		t.Fatalf(
			"expected ErrUngroundedDueText, got %v",
			err,
		)
	}
}

func TestDueTextPassesWhenPresentInEvidence(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Alex will prepare the deployment",

		Owner: "Alex",

		DueText: "by Thursday",

		Explicit: true,

		Confidence: 0.95,
	}

	err := ValidateGrounding(
		candidate,
		"Alex will prepare the deployment by Thursday.",
	)

	if err != nil {
		t.Fatalf(
			"expected grounded deadline, got %v",
			err,
		)
	}
}

func TestEmptyDueTextDoesNotRequireDeadlineEvidence(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Alex will prepare the deployment",

		Owner: "Alex",

		DueText: "",

		Explicit: true,

		Confidence: 0.9,
	}

	err := ValidateGrounding(
		candidate,
		"Alex will prepare the deployment.",
	)

	if err != nil {
		t.Fatalf(
			"expected no grounding error, got %v",
			err,
		)
	}
}
