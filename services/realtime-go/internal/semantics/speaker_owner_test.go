package semantics

import "testing"

func TestResolveSpeakerOwnerFromFirstPersonPronoun(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindCommitment,
		Summary:    "Send the report by Friday",
		Owner:      "I",
		DueText:    "Friday",
		Explicit:   true,
		Confidence: 0.95,
	}

	got := ResolveSpeakerOwner(
		candidate,
		"I will send the report by Friday.",
		"participant-123",
	)

	if got.Owner != "participant-123" {
		t.Fatalf(
			"expected trusted speaker owner, got %q",
			got.Owner,
		)
	}
}

func TestResolveSpeakerOwnerFromEmptyOwner(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindCommitment,
		Summary:    "Send the report",
		Owner:      "",
		Explicit:   true,
		Confidence: 0.95,
	}

	got := ResolveSpeakerOwner(
		candidate,
		"I promise to send the report.",
		"participant-123",
	)

	if got.Owner != "participant-123" {
		t.Fatalf(
			"expected trusted speaker owner, got %q",
			got.Owner,
		)
	}
}

func TestResolveSpeakerOwnerNeverOverwritesNamedOwner(
	t *testing.T,
) {
	t.Parallel()

	candidate := Candidate{
		Kind:       KindCommitment,
		Summary:    "Alex will send the report",
		Owner:      "Alex",
		Explicit:   true,
		Confidence: 0.95,
	}

	got := ResolveSpeakerOwner(
		candidate,
		"I will send the report.",
		"participant-123",
	)

	if got.Owner != "Alex" {
		t.Fatalf(
			"named owner must not be overwritten, got %q",
			got.Owner,
		)
	}
}
