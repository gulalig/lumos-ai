package groqsemantic

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
)

func TestExtractRejectsOversizedSuccessBody(
	t *testing.T,
) {
	t.Parallel()

	server :=
		httptest.NewServer(
			http.HandlerFunc(
				func(
					w http.ResponseWriter,
					r *http.Request,
				) {
					w.Header().Set(
						"Content-Type",
						"application/json",
					)

					w.WriteHeader(
						http.StatusOK,
					)

					_, _ = w.Write(
						bytes.Repeat(
							[]byte("x"),
							maxSuccessBodyBytes+1,
						),
					)
				},
			),
		)

	defer server.Close()

	extractor, err :=
		New(
			"test-api-key",
			server.URL,
			"test-model",
		)

	if err != nil {
		t.Fatalf(
			"create extractor: %v",
			err,
		)
	}

	turn, err :=
		evidence.NewTurn(
			"meeting-1",
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

	_, err =
		extractor.Extract(
			context.Background(),
			turn,
		)

	if !errors.Is(
		err,
		ErrResponseBodyTooLarge,
	) {
		t.Fatalf(
			"expected ErrResponseBodyTooLarge, got %v",
			err,
		)
	}
}

func TestSemanticSchemaLimitsObservationCount(
	t *testing.T,
) {
	t.Parallel()

	schema :=
		semanticSchema()

	properties, ok :=
		schema["properties"].(map[string]any)

	if !ok {
		t.Fatal(
			"schema properties missing or invalid",
		)
	}

	observations, ok :=
		properties["observations"].(map[string]any)

	if !ok {
		t.Fatal(
			"observations schema missing or invalid",
		)
	}

	maxItems, ok :=
		observations["maxItems"].(int)

	if !ok {
		t.Fatalf(
			"expected observations.maxItems int, got %T",
			observations["maxItems"],
		)
	}

	if maxItems !=
		maxSemanticResponseItems {

		t.Fatalf(
			"expected maxItems %d, got %d",
			maxSemanticResponseItems,
			maxItems,
		)
	}
}
