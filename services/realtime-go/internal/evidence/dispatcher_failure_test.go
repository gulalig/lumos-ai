package evidence

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"
)

var errInjectedEvidencePublishFailure = errors.New(
	"injected evidence publish failure",
)

type failingEvidencePublisher struct {
	started chan struct{}
}

func (
	p *failingEvidencePublisher,
) Publish(
	_ context.Context,
	_ Turn,
) (
	string,
	error,
) {
	select {
	case <-p.started:

	default:
		close(
			p.started,
		)
	}

	return "",
		errInjectedEvidencePublishFailure
}

func TestDispatcherReportsPublishFailureAndStopsAccepting(
	t *testing.T,
) {
	publisher :=
		&failingEvidencePublisher{
			started: make(
				chan struct{},
			),
		}

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

			EventID: "evidence-1",

			MeetingID: "meeting-1",

			ParticipantID: "participant-1",

			TrackID: "track-1",

			TurnOrder: 1,

			Text: "We decided to deploy on Friday.",

			CapturedAt: time.Now().
				UTC(),
		}

	if err :=
		dispatcher.Enqueue(
			context.Background(),
			turn,
		); err != nil {

		t.Fatalf(
			"enqueue first evidence: %v",
			err,
		)
	}

	select {
	case err :=
		<-dispatcher.Errors():

		if !errors.Is(
			err,
			errInjectedEvidencePublishFailure,
		) {
			t.Fatalf(
				"expected injected publish failure, got %v",
				err,
			)
		}

	case <-time.After(
		2 * time.Second,
	):
		t.Fatal(
			"timed out waiting for dispatcher failure",
		)
	}

	second :=
		turn

	second.EventID =
		"evidence-2"

	err :=
		dispatcher.Enqueue(
			context.Background(),
			second,
		)

	if !errors.Is(
		err,
		ErrDispatcherFailed,
	) {
		t.Fatalf(
			"expected ErrDispatcherFailed after terminal publish failure, got %v",
			err,
		)
	}
}
