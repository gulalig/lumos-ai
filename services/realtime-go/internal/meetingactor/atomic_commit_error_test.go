package meetingactor

import (
	"errors"
	"testing"

	"lumos/realtime-go/internal/redisclient"
)

func TestAtomicCommitOutcomeUnknownIsFatal(
	t *testing.T,
) {
	t.Parallel()

	err :=
		errors.Join(
			redisclient.ErrAtomicCommitOutcomeUnknown,
			errors.New(
				"connection reset by peer",
			),
		)

	if !isFatalProcessError(
		err,
	) {
		t.Fatal(
			"atomic commit with unknown outcome must be fatal",
		)
	}
}

func TestFencedBatchInvalidStateIsFatal(
	t *testing.T,
) {
	t.Parallel()

	err :=
		errors.Join(
			redisclient.ErrFencedBatchInvalidState,
			errors.New(
				"semantic stream has invalid redis type",
			),
		)

	if !isFatalProcessError(
		err,
	) {
		t.Fatal(
			"invalid fenced batch state must be fatal",
		)
	}
}

func TestNormalSemanticFailureRemainsRetryable(
	t *testing.T,
) {
	t.Parallel()

	err :=
		errors.New(
			"semantic extractor temporarily unavailable",
		)

	if isFatalProcessError(
		err,
	) {
		t.Fatal(
			"normal semantic failure must remain retryable",
		)
	}
}
