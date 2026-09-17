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
