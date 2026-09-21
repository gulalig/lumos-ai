package semantics

import (
	"lumos/realtime-go/internal/evidence"
)

type Coverage struct {
	ExpectsDecision bool
	HasDecision     bool
}

func AnalyzeCoverage(
	candidates []Candidate,
	turn evidence.Turn,
) Coverage {
	coverage := Coverage{
		ExpectsDecision: evidenceContainsExplicitDecision(
			turn.Text,
		),
	}

	for _, candidate := range candidates {
		if err := ValidateGrounding(
			candidate,
			turn.Text,
		); err != nil {
			continue
		}

		if _, err := candidate.ToObservation(
			turn,
		); err != nil {
			continue
		}

		if candidate.Kind == KindDecision {
			coverage.HasDecision = true
		}
	}

	return coverage
}

func (c Coverage) HasGap() bool {
	return c.ExpectsDecision &&
		!c.HasDecision
}

func evidenceContainsExplicitDecision(
	text string,
) bool {
	normalized := normalizeEvidence(
		text,
	)

	return containsAny(
		normalized,
		explicitDecisionMarkers,
	)
}
