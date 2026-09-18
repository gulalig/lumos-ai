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
	text := normalizeEvidence(
		evidenceText,
	)

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

		if !strings.Contains(
			text,
			owner,
		) {
			return ErrUngroundedOwner
		}
	}

	return nil
}

func normalizeEvidence(
	value string,
) string {
	return strings.ToLower(
		strings.TrimSpace(value),
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
