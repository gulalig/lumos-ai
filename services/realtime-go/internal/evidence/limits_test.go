package evidence

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewTurnAcceptsExactMaximumTextSize(
	t *testing.T,
) {
	t.Parallel()

	text :=
		strings.Repeat(
			"a",
			MaxTurnTextBytes,
		)

	turn, err :=
		NewTurn(
			"meeting-1",
			"participant-1",
			"track-1",
			1,
			text,
			time.Now().
				UTC(),
		)

	if err != nil {
		t.Fatalf(
			"expected exact maximum text size to be accepted: %v",
			err,
		)
	}

	if len(
		turn.Text,
	) != MaxTurnTextBytes {

		t.Fatalf(
			"expected %d text bytes, got %d",
			MaxTurnTextBytes,
			len(turn.Text),
		)
	}
}

func TestNewTurnRejectsTextAboveMaximumSize(
	t *testing.T,
) {
	t.Parallel()

	text :=
		strings.Repeat(
			"a",
			MaxTurnTextBytes+1,
		)

	_, err :=
		NewTurn(
			"meeting-1",
			"participant-1",
			"track-1",
			1,
			text,
			time.Now().
				UTC(),
		)

	if !errors.Is(
		err,
		ErrTurnTextTooLarge,
	) {
		t.Fatalf(
			"expected ErrTurnTextTooLarge, got %v",
			err,
		)
	}
}

type countingEvidencePublisher struct {
	calls atomic.Int64
}

func (
	p *countingEvidencePublisher,
) Publish(
	_ context.Context,
	_ Turn,
) (
	string,
	error,
) {
	p.calls.Add(
		1,
	)

	return "unexpected-stream-id",
		nil
}

func TestDispatcherFailsClosedOnOversizedEvidence(
	t *testing.T,
) {
	publisher :=
		&countingEvidencePublisher{}

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	dispatcher :=
		NewDispatcher(
			publisher,
			logger,
		)

	t.Cleanup(
		dispatcher.Close,
	)

	turn :=
		Turn{
			SchemaVersion: SchemaVersion,

			EventID: "oversized-evidence",

			MeetingID: "meeting-1",

			ParticipantID: "participant-1",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: strings.Repeat(
				"a",
				MaxTurnTextBytes+1,
			),

			CapturedAt: time.Now().
				UTC(),
		}

	err :=
		dispatcher.Enqueue(
			context.Background(),
			turn,
		)

	if !errors.Is(
		err,
		ErrDispatcherFailed,
	) {
		t.Fatalf(
			"expected ErrDispatcherFailed, got %v",
			err,
		)
	}

	if !errors.Is(
		err,
		ErrTurnTextTooLarge,
	) {
		t.Fatalf(
			"expected underlying ErrTurnTextTooLarge, got %v",
			err,
		)
	}

	select {
	case failure :=
		<-dispatcher.Errors():

		if !errors.Is(
			failure,
			ErrTurnTextTooLarge,
		) {
			t.Fatalf(
				"expected dispatcher failure to preserve ErrTurnTextTooLarge, got %v",
				failure,
			)
		}

	case <-time.After(
		time.Second,
	):
		t.Fatal(
			"timed out waiting for dispatcher terminal failure",
		)
	}

	if calls :=
		publisher.calls.Load(); calls != 0 {

		t.Fatalf(
			"oversized evidence unexpectedly reached publisher %d times",
			calls,
		)
	}
}
