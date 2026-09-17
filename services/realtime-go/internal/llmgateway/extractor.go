package llmgateway

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
	defaultHTTPTimeout = 8 * time.Second
	maxErrorBodyBytes  = 4 * 1024
)

var (
	ErrEmptyResponse = errors.New(
		"llm gateway returned no choices",
	)

	ErrEmptyContent = errors.New(
		"llm gateway returned empty content",
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
	apiKey = strings.TrimSpace(apiKey)
	baseURL = strings.TrimRight(
		strings.TrimSpace(baseURL),
		"/",
	)
	model = strings.TrimSpace(model)

	if apiKey == "" {
		return nil, errors.New(
			"assemblyai api key is required",
		)
	}

	if baseURL == "" {
		return nil, errors.New(
			"llm gateway base url is required",
		)
	}

	if model == "" {
		return nil, errors.New(
			"llm gateway model is required",
		)
	}

	return &Extractor{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,

		httpClient: &http.Client{
			Timeout: defaultHTTPTimeout,
		},
	}, nil
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model string `json:"model"`

	Messages []chatMessage `json:"messages"`

	MaxTokens int `json:"max_tokens"`

	ResponseFormat responseFormat `json:"response_format"`
}

type responseFormat struct {
	Type       string     `json:"type"`
	JSONSchema jsonSchema `json:"json_schema"`
}

type jsonSchema struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
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

func (e *Extractor) Extract(
	ctx context.Context,
	turn evidence.Turn,
) ([]semantics.Candidate, error) {
	requestBody := chatRequest{
		Model: e.model,

		Messages: []chatMessage{
			{
				Role:    "system",
				Content: semanticSystemPrompt,
			},
			{
				Role: "user",
				Content: buildEvidencePrompt(
					turn,
				),
			},
		},

		MaxTokens: 500,

		ResponseFormat: responseFormat{
			Type: "json_schema",

			JSONSchema: jsonSchema{
				Name: "lumos_semantic_observations",

				Strict: true,

				Schema: semanticSchema(),
			},
		},
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf(
			"marshal llm gateway request: %w",
			err,
		)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		e.baseURL+"/chat/completions",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf(
			"create llm gateway request: %w",
			err,
		)
	}

	request.Header.Set(
		"Authorization",
		e.apiKey,
	)

	request.Header.Set(
		"Content-Type",
		"application/json",
	)

	response, err := e.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf(
			"call llm gateway: %w",
			err,
		)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {
		errorBody, _ := io.ReadAll(
			io.LimitReader(
				response.Body,
				maxErrorBodyBytes,
			),
		)

		return nil, fmt.Errorf(
			"llm gateway returned status %d: %s",
			response.StatusCode,
			strings.TrimSpace(
				string(errorBody),
			),
		)
	}

	var completion chatResponse

	if err := json.NewDecoder(
		response.Body,
	).Decode(&completion); err != nil {
		return nil, fmt.Errorf(
			"decode llm gateway response: %w",
			err,
		)
	}

	if len(completion.Choices) == 0 {
		return nil, ErrEmptyResponse
	}

	content := strings.TrimSpace(
		completion.Choices[0].
			Message.
			Content,
	)

	if content == "" {
		return nil, ErrEmptyContent
	}

	var semanticResult semanticResponse

	if err := json.Unmarshal(
		[]byte(content),
		&semanticResult,
	); err != nil {
		return nil, fmt.Errorf(
			"decode semantic output: %w",
			err,
		)
	}

	return semanticResult.Observations, nil
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
