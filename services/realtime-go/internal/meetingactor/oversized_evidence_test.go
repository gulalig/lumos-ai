package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type countingOversizedExtractor struct {
	calls atomic.Int64
}

func (
	e *countingOversizedExtractor,
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

func TestPrepareEvidenceRejectsOversizedTurnBeforeExtraction(
	t *testing.T,
) {
	t.Parallel()

	extractor :=
		&countingOversizedExtractor{}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	const meetingID = "meeting-oversized-durable"

	actor :=
		New(
			meetingID,
			extractor,
			logger,
		)

	turn :=
		evidence.Turn{
			SchemaVersion: evidence.SchemaVersion,

			EventID: "external-oversized-event",

			MeetingID: meetingID,

			ParticipantID: "participant-1",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: strings.Repeat(
				"a",
				evidence.MaxTurnTextBytes+1,
			),

			CapturedAt: time.Now().
				UTC(),
		}

	payload, err :=
		json.Marshal(
			turn,
		)

	if err != nil {
		t.Fatalf(
			"marshal oversized evidence: %v",
			err,
		)
	}

	_, err =
		actor.PrepareEvidence(
			context.Background(),
			string(
				payload,
			),
		)

	if !errors.Is(
		err,
		evidence.ErrTurnTextTooLarge,
	) {
		t.Fatalf(
			"expected ErrTurnTextTooLarge, got %v",
			err,
		)
	}

	if calls :=
		extractor.calls.Load(); calls != 0 {

		t.Fatalf(
			"oversized evidence reached semantic extractor %d times",
			calls,
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"oversized evidence unexpectedly advanced actor turn state",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"oversized evidence unexpectedly advanced actor observations: %d",
			len(actor.previousObservations),
		)
	}
}
