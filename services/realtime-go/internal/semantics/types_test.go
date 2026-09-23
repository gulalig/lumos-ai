package semantics

import "testing"

func TestExplicitCommitmentAllowsMissingOwner(
	t *testing.T,
) {
	t.Parallel()

	observation := Observation{
		ID: "observation-1",

		Kind: KindCommitment,

		EvidenceEventID: "evidence-1",

		EvidenceText: "We need to prepare the launch checklist.",

		Summary: "Prepare the launch checklist",

		Explicit: true,

		Confidence: 0.99,
	}

	if err := observation.Validate(); err != nil {
		t.Fatalf(
			"expected explicit commitment without owner to be valid, got %v",
			err,
		)
	}
}

func TestImplicitCommitmentStillFails(
	t *testing.T,
) {
	t.Parallel()

	observation := Observation{
		Kind: KindCommitment,

		EvidenceEventID: "evidence-1",

		EvidenceText: "Maybe we should prepare the launch checklist.",

		Summary: "Prepare the launch checklist",

		Explicit: false,

		Confidence: 0.9,
	}

	err := observation.Validate()

	if err != ErrImplicitCommitment {
		t.Fatalf(
			"expected ErrImplicitCommitment, got %v",
			err,
		)
	}
}

func TestCommitmentStillRequiresSummary(
	t *testing.T,
) {
	t.Parallel()

	observation := Observation{
		Kind: KindCommitment,

		EvidenceEventID: "evidence-1",

		Explicit: true,

		Confidence: 0.9,
	}

	err := observation.Validate()

	if err != ErrMissingSummary {
		t.Fatalf(
			"expected ErrMissingSummary, got %v",
			err,
		)
	}
}
