package groqsemantic

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

const (
	httpTimeout         = 8 * time.Second
	maxErrorBodyBytes   = 4 * 1024
	maxSuccessBodyBytes = 64 * 1024
)

var (
	ErrEmptyResponse = errors.New(
		"groq returned no choices",
	)

	ErrEmptyContent = errors.New(
		"groq returned empty content",
	)

	ErrResponseBodyTooLarge = errors.New(
		"groq response body exceeds maximum size",
	)
)

type Extractor struct {
	apiKey  string
	baseURL string
	model   string

	httpClient *http.Client
}

func New(
	apiKey string,
	baseURL string,
	model string,
) (*Extractor, error) {
	apiKey = strings.TrimSpace(
		apiKey,
	)

	baseURL = strings.TrimRight(
		strings.TrimSpace(
			baseURL,
		),
		"/",
	)

	model = strings.TrimSpace(
		model,
	)

	if apiKey == "" {
		return nil, errors.New(
			"groq api key is required",
		)
	}

	if baseURL == "" {
		return nil, errors.New(
			"groq base url is required",
		)
	}

	if model == "" {
		return nil, errors.New(
			"groq model is required",
		)
	}

	return &Extractor{
		apiKey: apiKey,

		baseURL: baseURL,

		model: model,

		httpClient: &http.Client{
			Timeout: httpTimeout,
		},
	}, nil
}

type chatMessage struct {
	Role string `json:"role"`

	Content string `json:"content"`
}

type chatRequest struct {
	Model string `json:"model"`

	Messages []chatMessage `json:"messages"`

	ResponseFormat responseFormat `json:"response_format"`

	ReasoningEffort string `json:"reasoning_effort,omitempty"`
}

type responseFormat struct {
	Type string `json:"type"`

	JSONSchema jsonSchema `json:"json_schema"`
}

type jsonSchema struct {
	Name string `json:"name"`

	Strict bool `json:"strict"`

	Schema map[string]any `json:"schema"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type semanticResponse struct {
	Observations []semantics.Candidate `json:"observations"`
}

// Extract preserves the original single-turn extraction path.
//
// Existing callers can continue using Extract exactly as before.
func (e *Extractor) Extract(
	ctx context.Context,
	turn evidence.Turn,
) ([]semantics.Candidate, error) {
	return e.extract(
		ctx,
		buildEvidencePrompt(
			turn,
		),
	)
}

// ExtractContext enables bounded adjacent-turn semantic extraction.
//
// The supplied EvidenceContext has already been constrained by the
// semantics package to an eligible previous/current turn pair.
func (e *Extractor) ExtractContext(
	ctx context.Context,
	input semantics.EvidenceContext,
) ([]semantics.Candidate, error) {
	return e.extract(
		ctx,
		buildContextPrompt(
			input,
		),
	)
}

func (e *Extractor) extract(
	ctx context.Context,
	userPrompt string,
) ([]semantics.Candidate, error) {
	requestBody := chatRequest{
		Model: e.model,

		Messages: []chatMessage{
			{
				Role: "system",

				Content: semanticSystemPrompt,
			},
			{
				Role: "user",

				Content: userPrompt,
			},
		},

		ResponseFormat: responseFormat{
			Type: "json_schema",

			JSONSchema: jsonSchema{
				Name: "lumos_semantic_observations",

				Strict: true,

				Schema: semanticSchema(),
			},
		},

		// Extraction is deliberately constrained enough that
		// expensive reasoning is not required for every
		// realtime transcript turn.
		ReasoningEffort: "low",
	}

	body, err := json.Marshal(
		requestBody,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"marshal groq request: %w",
			err,
		)
	}

	request, err :=
		http.NewRequestWithContext(
			ctx,
			http.MethodPost,
			e.baseURL+
				"/chat/completions",
			bytes.NewReader(
				body,
			),
		)

	if err != nil {
		return nil, fmt.Errorf(
			"create groq request: %w",
			err,
		)
	}

	request.Header.Set(
		"Authorization",
		"Bearer "+e.apiKey,
	)

	request.Header.Set(
		"Content-Type",
		"application/json",
	)

	response, err :=
		e.httpClient.Do(
			request,
		)

	if err != nil {
		return nil, fmt.Errorf(
			"call groq api: %w",
			err,
		)
	}

	defer response.Body.Close()

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {

		errorBody, _ :=
			io.ReadAll(
				io.LimitReader(
					response.Body,
					maxErrorBodyBytes,
				),
			)

		return nil, fmt.Errorf(
			"groq returned status %d: %s",
			response.StatusCode,
			strings.TrimSpace(
				string(
					errorBody,
				),
			),
		)
	}

	responseBody, err := io.ReadAll(
		io.LimitReader(
			response.Body,
			maxSuccessBodyBytes+1,
		),
	)
	if err != nil {
		return nil, fmt.Errorf(
			"read groq response: %w",
			err,
		)
	}

	if len(responseBody) >
		maxSuccessBodyBytes {

		return nil, fmt.Errorf(
			"%w: got %d bytes, max %d",
			ErrResponseBodyTooLarge,
			len(responseBody),
			maxSuccessBodyBytes,
		)
	}

	var completion chatResponse

	if err := json.Unmarshal(
		responseBody,
		&completion,
	); err != nil {
		return nil, fmt.Errorf(
			"decode groq response: %w",
			err,
		)
	}

	if len(
		completion.Choices,
	) == 0 {
		return nil,
			ErrEmptyResponse
	}

	content :=
		strings.TrimSpace(
			completion.
				Choices[0].
				Message.
				Content,
		)

	if content == "" {
		return nil,
			ErrEmptyContent
	}

	var result semanticResponse

	if err := json.Unmarshal(
		[]byte(
			content,
		),
		&result,
	); err != nil {
		return nil, fmt.Errorf(
			"decode groq semantic output: %w",
			err,
		)
	}

	return result.Observations,
		nil
}

func buildEvidencePrompt(
	turn evidence.Turn,
) string {
	return fmt.Sprintf(
		"Speaker identity: %s\n"+
			"Final transcript evidence:\n%s",
		turn.ParticipantID,
		turn.Text,
	)
}

func buildContextPrompt(
	input semantics.EvidenceContext,
) string {
	if input.Previous == nil {
		return buildEvidencePrompt(
			input.Current,
		)
	}

	return fmt.Sprintf(
		"Speaker identity: %s\n"+
			"Previous adjacent final transcript evidence "+
			"(context only):\n%s\n\n"+
			"Current final transcript evidence:\n%s\n\n"+
			"Use the previous turn only to resolve whether "+
			"the current turn completes or refines it. "+
			"Do not repeat an observation from the previous "+
			"turn unless the current turn materially adds "+
			"new grounded information.",
		input.Current.ParticipantID,
		input.Previous.Text,
		input.Current.Text,
	)
}
