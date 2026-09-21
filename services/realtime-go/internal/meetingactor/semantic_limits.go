package meetingactor

import (
	"errors"
	"fmt"
)

const (
	maxSemanticCandidatesPerEvidence = 16
)

var ErrTooManySemanticCandidates = errors.New(
	"semantic extractor returned too many candidates",
)

func validateSemanticCandidateCount(
	count int,
) error {
	if count <=
		maxSemanticCandidatesPerEvidence {

		return nil
	}

	return fmt.Errorf(
		"%w: got %d, max %d",
		ErrTooManySemanticCandidates,
		count,
		maxSemanticCandidatesPerEvidence,
	)
}
