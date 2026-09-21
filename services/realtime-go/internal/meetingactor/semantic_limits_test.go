package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type oversizedCandidateExtractor struct {
	count int
}

func (
	e *oversizedCandidateExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) (
	[]semantics.Candidate,
	error,
) {
	return make(
			[]semantics.Candidate,
			e.count,
		),
		nil
}

func TestPrepareEvidenceRejectsTooManySemanticCandidates(
	t *testing.T,
) {
	t.Parallel()

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	extractor :=
		&oversizedCandidateExtractor{
			count: maxSemanticCandidatesPerEvidence + 1,
		}

	const meetingID = "meeting-semantic-limit"

	actor :=
		New(
			meetingID,
			extractor,
			logger,
		)

	turn, err :=
		evidence.NewTurn(
			meetingID,
			"participant-1",
			"track-1",
			1,
			"We agreed to deploy on Friday.",
			time.Now().
				UTC(),
		)

	if err != nil {
		t.Fatalf(
			"create evidence turn: %v",
			err,
		)
	}

	payload, err :=
		json.Marshal(
			turn,
		)

	if err != nil {
		t.Fatalf(
			"marshal evidence: %v",
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
		ErrTooManySemanticCandidates,
	) {
		t.Fatalf(
			"expected ErrTooManySemanticCandidates, got %v",
			err,
		)
	}

	if actor.previousTurn != nil {
		t.Fatal(
			"oversized semantic output unexpectedly advanced actor turn state",
		)
	}

	if len(
		actor.previousObservations,
	) != 0 {
		t.Fatalf(
			"oversized semantic output unexpectedly advanced actor observations: %d",
			len(actor.previousObservations),
		)
	}
}

func TestPrepareEvidenceAcceptsMaximumSemanticCandidateCount(
	t *testing.T,
) {
	t.Parallel()

	if err :=
		validateSemanticCandidateCount(
			maxSemanticCandidatesPerEvidence,
		); err != nil {

		t.Fatalf(
			"expected exact semantic candidate limit to be accepted: %v",
			err,
		)
	}
}
