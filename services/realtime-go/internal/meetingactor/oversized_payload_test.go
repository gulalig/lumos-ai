package meetingactor

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type countingPayloadExtractor struct {
	calls atomic.Int64
}

func (
	e *countingPayloadExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) (
	[]semantics.Candidate,
	error,
) {
	e.calls.Add(
		1,
	)

	return nil,
		errors.New(
			"extractor must not be called",
		)
}

func TestPrepareEvidenceRejectsOversizedPayloadBeforeJSONDecode(
	t *testing.T,
) {
	t.Parallel()

	extractor :=
		&countingPayloadExtractor{}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	actor :=
		New(
			"meeting-payload-limit",
			extractor,
			logger,
		)

	// Deliberately not valid JSON.
	//
	// Size validation must happen before json.Unmarshal,
	// therefore the returned error must be the resource-limit
	// error rather than a JSON syntax error.
	payload :=
		strings.Repeat(
			"x",
			evidence.MaxTurnPayloadBytes+1,
		)

	_, err :=
		actor.PrepareEvidence(
			context.Background(),
			payload,
		)

	if !errors.Is(
		err,
		evidence.ErrTurnPayloadTooLarge,
	) {
		t.Fatalf(
			"expected ErrTurnPayloadTooLarge, got %v",
			err,
		)
	}

	if calls :=
		extractor.calls.Load(); calls != 0 {

		t.Fatalf(
			"oversized raw payload reached extractor %d times",
			calls,
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"oversized raw payload unexpectedly advanced actor turn state",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"oversized raw payload unexpectedly advanced observations: %d",
			len(actor.previousObservations),
		)
	}
}
