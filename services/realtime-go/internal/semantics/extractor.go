package semantics

import (
	"context"

	"lumos/realtime-go/internal/evidence"
)

type Extractor interface {
	Extract(
		ctx context.Context,
		turn evidence.Turn,
	) ([]Candidate, error)
}

// ContextualExtractor is an optional capability.
//
// Existing extractors remain valid Extractor implementations.
// Components can opt into bounded adjacent-turn context without
// changing the existing Extractor interface.
type ContextualExtractor interface {
	ExtractContext(
		ctx context.Context,
		input EvidenceContext,
	) ([]Candidate, error)
}

func ExtractWithContext(
	ctx context.Context,
	extractor Extractor,
	input EvidenceContext,
) ([]Candidate, error) {
	if input.HasPrevious() {
		contextual, ok :=
			extractor.(ContextualExtractor)

		if ok {
			return contextual.ExtractContext(
				ctx,
				input,
			)
		}
	}

	return extractor.Extract(
		ctx,
		input.Current,
	)
}
