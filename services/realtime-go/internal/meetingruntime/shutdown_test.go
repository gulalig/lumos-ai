package meetingruntime

import (
	"context"
	"errors"
	"testing"

	"lumos/realtime-go/internal/meetinglease"
)

func TestOwnershipLossCauseCanBeDetected(
	t *testing.T,
) {
	t.Parallel()

	ctx, cancel :=
		context.WithCancelCause(
			context.Background(),
		)

	cause :=
		errors.Join(
			meetinglease.ErrLeaseLost,
			errors.New(
				"redis unavailable",
			),
		)

	cancel(
		cause,
	)

	if !errors.Is(
		context.Cause(ctx),
		meetinglease.ErrLeaseLost,
	) {
		t.Fatal(
			"expected lease loss cancellation cause",
		)
	}
}

func TestNormalCancellationIsNotLeaseLoss(
	t *testing.T,
) {
	t.Parallel()

	ctx, cancel :=
		context.WithCancelCause(
			context.Background(),
		)

	cancel(
		nil,
	)

	if errors.Is(
		context.Cause(ctx),
		meetinglease.ErrLeaseLost,
	) {
		t.Fatal(
			"normal cancellation must not be treated as lease loss",
		)
	}

	if !errors.Is(
		context.Cause(ctx),
		context.Canceled,
	) {
		t.Fatalf(
			"expected context.Canceled, got %v",
			context.Cause(ctx),
		)
	}
}
