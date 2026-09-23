package assemblyai

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/coder/websocket"
)

type Client struct {
	apiKey       string
	streamingURL string
	httpClient   *http.Client
}

func New(apiKey string, streamingURL string) *Client {
	return &Client{
		apiKey:       apiKey,
		streamingURL: streamingURL,
		httpClient:   &http.Client{},
	}
}

func (c *Client) Check(ctx context.Context) error {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://streaming.assemblyai.com/v3/token?expires_in_seconds=60",
		nil,
	)
	if err != nil {
		return fmt.Errorf("create assemblyai request: %w", err)
	}

	req.Header.Set("Authorization", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("assemblyai connectivity check: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf(
			"assemblyai authentication failed: status %d",
			resp.StatusCode,
		)
	}

	return nil
}

func (c *Client) StreamingURL() (string, error) {
	u, err := url.Parse(c.streamingURL)
	if err != nil {
		return "", fmt.Errorf("parse assemblyai streaming url: %w", err)
	}

	query := u.Query()
	query.Set("sample_rate", "16000")
	query.Set("speech_model", "universal-3-5-pro")
	query.Set("mode", "min_latency")
	query.Set("voice_focus", "near-field")
	query.Set("speaker_labels", "true")

	u.RawQuery = query.Encode()

	return u.String(), nil
}

func (c *Client) DialOptions() *websocket.DialOptions {
	return &websocket.DialOptions{
		HTTPHeader: http.Header{
			"Authorization": []string{c.apiKey},
		},
	}
}
