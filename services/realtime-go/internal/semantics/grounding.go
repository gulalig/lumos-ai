package semantics

import (
	"strings"
)

var explicitDecisionMarkers = []string{
	"we decided",
	"we have decided",
	"we've decided",
	"we agreed",
	"we have agreed",
	"decided to",
	"we've agreed",
	"it was decided",
	"it is decided",
	"the decision is",
	"final decision",
	"we settled on",
	"we're going with",
	"we are going with",
}

func ValidateGrounding(
	candidate Candidate,
	evidenceText string,
) error {
	return ValidateGroundingForSpeaker(
		candidate,
		evidenceText,
		"",
	)
}

func ValidateGroundingForSpeaker(
	candidate Candidate,
	evidenceText string,
	speakerIdentity string,
) error {
	text := normalizeEvidence(
		evidenceText,
	)

	// A deadline may be emitted for several kinds,
	// not only commitments.
	//
	// Never trust an LLM-generated dueText unless
	// that wording is actually present in evidence.
	dueText := normalizeEvidence(
		candidate.DueText,
	)

	if dueText != "" &&
		!strings.Contains(
			text,
			dueText,
		) {
		return ErrUngroundedDueText
	}

	switch candidate.Kind {
	case KindDecision:
		if !containsAny(
			text,
			explicitDecisionMarkers,
		) {
			return ErrUngroundedDecision
		}

	case KindCommitment:
		owner := normalizeEvidence(
			candidate.Owner,
		)

		if owner == "" {
			return ErrMissingOwner
		}

		// Named owner explicitly present in transcript.
		if strings.Contains(
			text,
			owner,
		) {
			break
		}

		// First-person commitment:
		//
		// "I will send the report."
		//
		// The transcript cannot literally contain the
		// LiveKit participant identity. We may therefore
		// accept that identity as owner ONLY when:
		//
		// 1. candidate owner exactly equals trusted speaker metadata
		// 2. evidence contains an explicit first-person commitment
		//
		// This preserves fail-closed owner grounding.
		speaker := normalizeEvidence(
			speakerIdentity,
		)

		if speaker != "" &&
			owner == speaker &&
			containsExplicitFirstPersonCommitment(
				text,
			) {
			break
		}

		return ErrUngroundedOwner
	}

	return nil
}

func containsExplicitFirstPersonCommitment(
	text string,
) bool {
	padded :=
		" " +
			normalizeEvidence(
				text,
			) +
			" "

	markers := []string{
		" i will ",
		" i'll ",
		" i’ll ",
		" i am going to ",
		" i'm going to ",
		" i’m going to ",
		" i commit to ",
		" i promise to ",
	}

	return containsAny(
		padded,
		markers,
	)
}

func normalizeEvidence(
	value string,
) string {
	return strings.ToLower(
		strings.TrimSpace(
			value,
		),
	)
}

func containsAny(
	text string,
	values []string,
) bool {
	for _, value := range values {
		if strings.Contains(
			text,
			value,
		) {
			return true
		}
	}

	return false
}
