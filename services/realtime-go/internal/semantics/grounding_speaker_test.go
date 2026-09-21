package semantics

import "testing"

func TestFirstPersonCommitmentAllowsExactSpeakerIdentity(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Speaker will send the final project report by Friday",

		Owner: "participant-123",

		DueText: "Friday",

		Explicit: true,

		Confidence: 0.95,
	}

	err := ValidateGroundingForSpeaker(
		candidate,
		"I will send the final project report by Friday.",
		"participant-123",
	)

	if err != nil {
		t.Fatalf(
			"expected first-person speaker commitment to be grounded, got %v",
			err,
		)
	}
}

func TestFirstPersonCommitmentRejectsDifferentSpeakerIdentity(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Another participant will send the report",

		Owner: "participant-attacker",

		DueText: "Friday",

		Explicit: true,

		Confidence: 0.95,
	}

	err := ValidateGroundingForSpeaker(
		candidate,
		"I will send the final project report by Friday.",
		"participant-123",
	)

	if err != ErrUngroundedOwner {
		t.Fatalf(
			"expected ErrUngroundedOwner, got %v",
			err,
		)
	}
}

func TestSpeakerIdentityDoesNotBypassNamedOwnerGrounding(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Sarah will send the report",

		Owner: "Sarah",

		Explicit: true,

		Confidence: 0.95,
	}

	err := ValidateGroundingForSpeaker(
		candidate,
		"I will send the final project report.",
		"participant-123",
	)

	if err != ErrUngroundedOwner {
		t.Fatalf(
			"expected ErrUngroundedOwner, got %v",
			err,
		)
	}
}

func TestSpeakerIdentityRequiresExplicitFirstPersonCommitment(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind: KindCommitment,

		Summary: "Speaker owns the report",

		Owner: "participant-123",

		Explicit: true,

		Confidence: 0.95,
	}

	err := ValidateGroundingForSpeaker(
		candidate,
		"The final project report is due soon.",
		"participant-123",
	)

	if err != ErrUngroundedOwner {
		t.Fatalf(
			"expected ErrUngroundedOwner, got %v",
			err,
		)
	}
}
