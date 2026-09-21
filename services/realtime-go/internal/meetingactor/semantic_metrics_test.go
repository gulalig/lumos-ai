package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/semantics"
)

type failingMetricsExtractor struct{}

func (
	*failingMetricsExtractor,
) Extract(
	_ context.Context,
	_ evidence.Turn,
) (
	[]semantics.Candidate,
	error,
) {
	return nil,
		errors.New(
			"semantic provider unavailable",
		)
}

func TestPrepareEvidenceRecordsSemanticExtractionMetrics(
	t *testing.T,
) {
	t.Parallel()

	metrics :=
		observability.NewMetrics()

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	const meetingID = "meeting-semantic-metrics"

	actor :=
		New(
			meetingID,
			&failingMetricsExtractor{},
			logger,
			metrics,
		)

	turn, err :=
		evidence.NewTurn(
			meetingID,
			"participant-1",
			"track-1",
			1,
			"We agreed to ship this on Friday.",
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

	if err == nil {
		t.Fatal(
			"expected semantic extraction failure",
		)
	}

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

	body :=
		recorder.Body.String()

	if !strings.Contains(
		body,
		"lumos_realtime_semantic_extraction_seconds_count 1",
	) {
		t.Fatal(
			"semantic extraction histogram was not recorded",
		)
	}

	if !strings.Contains(
		body,
		`lumos_realtime_failures_total{component="meeting_actor",reason="semantic_extraction"} 1`,
	) {
		t.Fatal(
			"semantic extraction failure counter was not recorded",
		)
	}
}
