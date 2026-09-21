package redisstream

import (
	"context"
	"encoding/json"
	"fmt"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
)

type EvidencePublisher struct {
	redis *redisclient.Client
	lease meetinglease.Lease
}

func NewEvidencePublisher(
	redisClient *redisclient.Client,
	lease meetinglease.Lease,
) *EvidencePublisher {
	return &EvidencePublisher{
		redis: redisClient,
		lease: lease,
	}
}

func (p *EvidencePublisher) Publish(
	ctx context.Context,
	turn evidence.Turn,
) (string, error) {
	if turn.MeetingID !=
		p.lease.MeetingID {

		return "", fmt.Errorf(
			"evidence meeting mismatch: lease=%q turn=%q",
			p.lease.MeetingID,
			turn.MeetingID,
		)
	}

	payload, err :=
		json.Marshal(
			turn,
		)

	if err != nil {
		return "", fmt.Errorf(
			"marshal evidence turn: %w",
			err,
		)
	}

	return p.redis.FencedXAdd(
		ctx,

		meetinglease.LeaseKey(
			p.lease.MeetingID,
		),

		meetinglease.FenceKey(
			p.lease.MeetingID,
		),

		p.lease.Token,

		p.lease.Fence,

		EvidenceStreamKey(
			turn.MeetingID,
		),

		map[string]any{
			"event_type": evidence.EventType,

			"schema_version": evidence.SchemaVersion,

			"event_id": turn.EventID,

			"payload": string(
				payload,
			),
		},
	)
}
