package meetingstate

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
)

const (
	replayBatchSize   int64 = 64
	liveReadBatchSize int64 = 32

	liveReadBlock = 2 * time.Second
)

type Projector struct {
	redis *redisclient.Client

	meetingID string

	logger *slog.Logger

	mu sync.RWMutex

	state *State

	lastStreamID string
}

func NewProjector(
	redisClient *redisclient.Client,
	meetingID string,
	logger *slog.Logger,
) (*Projector, error) {
	state, err := New(
		meetingID,
	)
	if err != nil {
		return nil, err
	}

	return &Projector{
		redis:        redisClient,
		meetingID:    meetingID,
		logger:       logger,
		state:        state,
		lastStreamID: "0-0",
	}, nil
}

func (p *Projector) Replay(
	ctx context.Context,
) error {
	stream := redisstream.SemanticStreamKey(
		p.meetingID,
	)

	start := "-"

	for {
		messages, err := p.redis.XRange(
			ctx,
			stream,
			start,
			"+",
			replayBatchSize,
		)
		if err != nil {
			return fmt.Errorf(
				"replay semantic stream: %w",
				err,
			)
		}

		if len(messages) == 0 {
			break
		}

		for _, message := range messages {
			if err := p.applyMessage(
				message,
			); err != nil {
				return fmt.Errorf(
					"replay semantic message %s: %w",
					message.ID,
					err,
				)
			}
		}

		lastID := messages[len(messages)-1].ID

		if len(messages) < int(replayBatchSize) {
			break
		}

		// Redis XRANGE supports exclusive IDs by
		// prefixing the ID with "(".
		start = "(" + lastID
	}

	snapshot := p.Snapshot()

	p.logger.Info(
		"meeting state replay completed",
		"meetingId",
		snapshot.MeetingID,
		"version",
		snapshot.Version,
		"decisions",
		len(snapshot.Decisions),
		"commitments",
		len(snapshot.Commitments),
		"proposals",
		len(snapshot.Proposals),
		"questions",
		len(snapshot.Questions),
	)

	return nil
}

func (p *Projector) Run(
	ctx context.Context,
) error {
	stream := redisstream.SemanticStreamKey(
		p.meetingID,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		p.mu.RLock()
		lastID := p.lastStreamID
		p.mu.RUnlock()

		streams, err := p.redis.XRead(
			ctx,
			stream,
			lastID,
			liveReadBatchSize,
			liveReadBlock,
		)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf(
				"tail semantic stream: %w",
				err,
			)
		}

		for _, result := range streams {
			for _, message := range result.Messages {
				if err := p.applyMessage(
					message,
				); err != nil {
					return fmt.Errorf(
						"apply semantic message %s: %w",
						message.ID,
						err,
					)
				}
			}
		}
	}
}

func (p *Projector) Snapshot() Snapshot {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return Snapshot{
		MeetingID: p.state.MeetingID,
		Version:   p.state.Version,

		Decisions: cloneItems(
			p.state.Decisions,
		),

		Commitments: cloneItems(
			p.state.Commitments,
		),

		Proposals: cloneItems(
			p.state.Proposals,
		),

		Questions: cloneItems(
			p.state.Questions,
		),
	}
}

func (p *Projector) applyMessage(
	message redis.XMessage,
) error {
	eventType, err := streamString(
		message.Values,
		"event_type",
	)
	if err != nil {
		return err
	}

	if eventType != redisstream.SemanticEventType {
		return fmt.Errorf(
			"unsupported semantic event type %q",
			eventType,
		)
	}

	payload, err := streamString(
		message.Values,
		"payload",
	)
	if err != nil {
		return err
	}

	var observation semantics.Observation

	if err := json.Unmarshal(
		[]byte(payload),
		&observation,
	); err != nil {
		return fmt.Errorf(
			"decode semantic observation: %w",
			err,
		)
	}

	if err := observation.Validate(); err != nil {
		return fmt.Errorf(
			"validate semantic observation: %w",
			err,
		)
	}

	p.mu.Lock()

	changed, err := p.state.Apply(
		observation,
	)
	if err != nil {
		p.mu.Unlock()

		return fmt.Errorf(
			"apply meeting state: %w",
			err,
		)
	}

	// Advance the cursor even for idempotent duplicates
	// and KindUnknown events.
	p.lastStreamID = message.ID

	version := p.state.Version
	decisions := len(p.state.Decisions)
	commitments := len(p.state.Commitments)
	proposals := len(p.state.Proposals)
	questions := len(p.state.Questions)

	p.mu.Unlock()

	if changed {
		p.logger.Info(
			"meeting state updated",
			"meetingId",
			p.meetingID,
			"streamId",
			message.ID,
			"observationId",
			observation.ID,
			"kind",
			observation.Kind,
			"supersedesObservationId",
			observation.SupersedesObservationID,
			"version",
			version,
			"decisions",
			decisions,
			"commitments",
			commitments,
			"proposals",
			proposals,
			"questions",
			questions,
		)
	}

	return nil
}

func streamString(
	values map[string]any,
	field string,
) (string, error) {
	value, exists := values[field]
	if !exists {
		return "", fmt.Errorf(
			"stream field %q is missing",
			field,
		)
	}

	switch typed := value.(type) {
	case string:
		return typed, nil

	case []byte:
		return string(typed), nil

	default:
		return "", fmt.Errorf(
			"stream field %q has unsupported type %T",
			field,
			value,
		)
	}
}
