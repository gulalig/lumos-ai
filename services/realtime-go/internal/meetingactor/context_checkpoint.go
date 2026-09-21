package meetingactor

import (
	"errors"
	"strings"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

const ContextCheckpointSchemaVersion = 1

var (
	ErrInvalidContextCheckpoint = errors.New(
		"invalid meeting actor context checkpoint",
	)
)

type ContextCheckpoint struct {
	SchemaVersion int `json:"schemaVersion"`

	MeetingID string `json:"meetingId"`

	EvidenceStreamID string `json:"evidenceStreamId"`

	Turn evidence.Turn `json:"turn"`

	Observations []semantics.Observation `json:"observations"`
}

func (c ContextCheckpoint) Validate() error {
	if c.SchemaVersion != ContextCheckpointSchemaVersion {
		return ErrInvalidContextCheckpoint
	}

	if strings.TrimSpace(
		c.MeetingID,
	) == "" {
		return ErrInvalidContextCheckpoint
	}

	if strings.TrimSpace(
		c.EvidenceStreamID,
	) == "" {
		return ErrInvalidContextCheckpoint
	}

	if c.Turn.MeetingID != c.MeetingID {
		return ErrInvalidContextCheckpoint
	}

	if strings.TrimSpace(
		c.Turn.EventID,
	) == "" {
		return ErrInvalidContextCheckpoint
	}

	for _, observation := range c.Observations {
		if err := observation.Validate(); err != nil {
			return ErrInvalidContextCheckpoint
		}
	}

	return nil
}

func ContextCheckpointKey(
	meetingID string,
) string {
	return "lumos:meeting:{" +
		meetingID +
		"}:actor-context"
}
