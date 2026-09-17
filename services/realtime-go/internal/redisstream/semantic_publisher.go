package redisstream

import (
	"context"
	"encoding/json"
	"fmt"

	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/semantics"
)

const semanticEventType = "semantic.observation.v1"

type SemanticPublisher struct {
	redis *redisclient.Client
}

func NewSemanticPublisher(
	redisClient *redisclient.Client,
) *SemanticPublisher {
	return &SemanticPublisher{
		redis: redisClient,
	}
}

func (p *SemanticPublisher) Publish(
	ctx context.Context,
	meetingID string,
	observation semantics.Observation,
) (string, error) {
	payload, err := json.Marshal(
		observation,
	)
	if err != nil {
		return "", fmt.Errorf(
			"marshal semantic observation: %w",
			err,
		)
	}

	return p.redis.XAdd(
		ctx,
		SemanticStreamKey(meetingID),
		map[string]any{
			"event_type": semanticEventType,
			"event_id":   observation.ID,
			"payload":    string(payload),
		},
	)
}
