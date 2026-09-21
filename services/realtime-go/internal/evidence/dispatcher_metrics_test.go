package evidence

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"lumos/realtime-go/internal/observability"
)

type metricsBlockingEvidencePublisher struct {
	started chan struct{}
	release chan struct{}

	startOnce sync.Once
}

func newMetricsBlockingEvidencePublisher() *metricsBlockingEvidencePublisher {
	return &metricsBlockingEvidencePublisher{
		started: make(
			chan struct{},
		),

		release: make(
			chan struct{},
		),
	}
}

func (
	p *metricsBlockingEvidencePublisher,
) Publish(
	ctx context.Context,
	_ Turn,
) (
	string,
	error,
) {
	p.startOnce.Do(
		func() {
			close(
				p.started,
			)
		},
	)

	select {
	case <-p.release:
		return "1-0", nil

	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func TestDispatcherRecordsQueueDepthAndBackpressure(
	t *testing.T,
) {
	publisher :=
		newMetricsBlockingEvidencePublisher()

	metrics :=
		observability.NewMetrics()

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
			metrics,
		)

	first :=
		dispatcherMetricsTurn(
			0,
		)

	if err :=
		dispatcher.Enqueue(
			context.Background(),
			first,
		); err != nil {

		t.Fatalf(
			"enqueue first turn: %v",
			err,
		)
	}

	select {
	case <-publisher.started:

	case <-time.After(
		time.Second,
	):
		t.Fatal(
			"publisher did not start",
		)
	}

	// The first turn is now in-flight inside the worker.
	//
	// Fill the entire bounded waiting queue behind it.
	for i := 0; i <
		defaultQueueSize; i++ {

		if err :=
			dispatcher.Enqueue(
				context.Background(),
				dispatcherMetricsTurn(
					i+1,
				),
			); err != nil {

			t.Fatalf(
				"fill queue at %d: %v",
				i,
				err,
			)
		}
	}

	assertDispatcherMetrics(
		t,
		metrics,
		[]string{
			fmt.Sprintf(
				"lumos_realtime_evidence_queue_depth %d",
				defaultQueueSize,
			),
			"lumos_realtime_evidence_queue_backpressure_total 0",
		},
	)

	blockedCtx, cancelBlocked :=
		context.WithCancel(
			context.Background(),
		)

	blockedResult :=
		make(
			chan error,
			1,
		)

	go func() {
		blockedResult <- dispatcher.Enqueue(
			blockedCtx,
			dispatcherMetricsTurn(
				defaultQueueSize+1,
			),
		)
	}()

	deadline :=
		time.Now().
			Add(
				time.Second,
			)

	for {
		body :=
			dispatcherMetricsBody(
				t,
				metrics,
			)

		if strings.Contains(
			body,
			"lumos_realtime_evidence_queue_backpressure_total 1",
		) {
			break
		}

		if time.Now().
			After(
				deadline,
			) {

			t.Fatal(
				"backpressure counter was not incremented",
			)
		}

		time.Sleep(
			time.Millisecond,
		)
	}

	// Saturated enqueue must still be blocked.
	select {
	case err :=
		<-blockedResult:

		t.Fatalf(
			"enqueue returned before cancellation: %v",
			err,
		)

	default:
	}

	cancelBlocked()

	select {
	case err :=
		<-blockedResult:

		if err !=
			context.Canceled {

			t.Fatalf(
				"expected context.Canceled, got %v",
				err,
			)
		}

	case <-time.After(
		time.Second,
	):
		t.Fatal(
			"blocked enqueue did not wake after cancellation",
		)
	}

	// The rejected/cancelled extra turn must not affect depth.
	assertDispatcherMetrics(
		t,
		metrics,
		[]string{
			fmt.Sprintf(
				"lumos_realtime_evidence_queue_depth %d",
				defaultQueueSize,
			),
			"lumos_realtime_evidence_queue_backpressure_total 1",
		},
	)

	close(
		publisher.release,
	)

	dispatcher.Close()

	// Every accepted queued turn was consumed before normal Close
	// returned, so local queue depth must return to zero.
	assertDispatcherMetrics(
		t,
		metrics,
		[]string{
			"lumos_realtime_evidence_queue_depth 0",
			"lumos_realtime_evidence_queue_backpressure_total 1",
		},
	)
}

func dispatcherMetricsTurn(
	index int,
) Turn {
	return Turn{
		EventID: fmt.Sprintf(
			"metrics-event-%d",
			index,
		),

		MeetingID: "metrics-meeting",

		Text: "hello",
	}
}

func assertDispatcherMetrics(
	t *testing.T,
	metrics *observability.Metrics,
	expected []string,
) {
	t.Helper()

	body :=
		dispatcherMetricsBody(
			t,
			metrics,
		)

	for _, metric := range expected {

		if !strings.Contains(
			body,
			metric,
		) {

			t.Fatalf(
				"metrics output missing %q",
				metric,
			)
		}
	}
}

func dispatcherMetricsBody(
	t *testing.T,
	metrics *observability.Metrics,
) string {
	t.Helper()

	request :=
		httptest.NewRequest(
			http.MethodGet,
			"/metrics",
			nil,
		)

	recorder :=
		httptest.NewRecorder()

	metrics.Handler().
		ServeHTTP(
			recorder,
			request,
		)

	if recorder.Code !=
		http.StatusOK {

		t.Fatalf(
			"metrics endpoint returned %d",
			recorder.Code,
		)
	}

	return recorder.Body.String()
}
