package meetingactor

import (
	"errors"
	"fmt"
	"testing"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
)

func TestFencedWriteRejectionBecomesLeaseLoss(
	t *testing.T,
) {
	t.Parallel()

	source :=
		fmt.Errorf(
			"publish semantic observation: %w",
			redisclient.ErrFencedWriteRejected,
		)

	err :=
		classifyProcessError(
			source,
		)

	if !errors.Is(
		err,
		meetinglease.ErrLeaseLost,
	) {
		t.Fatalf(
			"expected meeting lease loss, got %v",
			err,
		)
	}

	if !errors.Is(
		err,
		redisclient.ErrFencedWriteRejected,
	) {
		t.Fatalf(
			"expected original fenced write rejection to remain discoverable, got %v",
			err,
		)
	}

	if !isFatalProcessError(
		err,
	) {
		t.Fatal(
			"expected fenced write rejection to be fatal",
		)
	}
}

func TestFencedAckNotPendingIsFatal(
	t *testing.T,
) {
	t.Parallel()

	err :=
		fmt.Errorf(
			"checkpoint commit: %w",
			redisclient.ErrFencedXAckNotPending,
		)

	if !isFatalProcessError(
		err,
	) {
		t.Fatal(
			"expected missing pending entry to be fatal",
		)
	}
}

func TestNormalProcessingFailureIsRetryable(
	t *testing.T,
) {
	t.Parallel()

	err :=
		errors.New(
			"semantic extraction temporarily unavailable",
		)

	classified :=
		classifyProcessError(
			err,
		)

	if !errors.Is(
		classified,
		err,
	) {
		t.Fatalf(
			"expected original processing error, got %v",
			classified,
		)
	}

	if isFatalProcessError(
		classified,
	) {
		t.Fatal(
			"normal processing failure must remain retryable",
		)
	}
}
