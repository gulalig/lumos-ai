package redisstream

import (
	"context"
	"encoding/json"
	"fmt"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/redisclient"
)

type EvidencePublisher struct {
	redis *redisclient.Client
}

func NewEvidencePublisher(
	redis *redisclient.Client,
) *EvidencePublisher {
	return &EvidencePublisher{
		redis: redis,
	}
}

func (p *EvidencePublisher) Publish(
	ctx context.Context,
	turn evidence.Turn,
) (string, error) {
	payload, err := json.Marshal(turn)
	if err != nil {
		return "", fmt.Errorf(
			"marshal evidence turn: %w",
			err,
		)
	}

	return p.redis.XAdd(
		ctx,
		EvidenceStreamKey(turn.MeetingID),
		map[string]any{
			"event_type":     evidence.EventType,
			"schema_version": evidence.SchemaVersion,
			"event_id":       turn.EventID,
			"payload":        string(payload),
		},
	)
}

func streamKey(
	meetingID string,
) string {
	return fmt.Sprintf(
		"lumos:meeting:{%s}:evidence",
		meetingID,
	)
}
