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

	LatestCommitmentTurn *evidence.Turn `json:"latestCommitmentTurn,omitempty"`

	LatestCommitmentObservation *semantics.Observation `json:"latestCommitmentObservation,omitempty"`
	OpenCommitments             []CommitmentContext    `json:"openCommitments"`
}

func (c ContextCheckpoint) Validate() error {
	for _, commitment := range c.OpenCommitments {
		if commitment.Turn.MeetingID != c.MeetingID || commitment.Observation.Kind != semantics.KindCommitment ||
			commitment.Observation.EvidenceEventID != commitment.Turn.EventID {
			return ErrInvalidContextCheckpoint
		}
		if err := commitment.Observation.Validate(); err != nil {
			return ErrInvalidContextCheckpoint
		}
	}
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

	if c.LatestCommitmentObservation != nil {
		if err :=
			c.LatestCommitmentObservation.Validate(); err != nil {

			return ErrInvalidContextCheckpoint
		}

		if c.LatestCommitmentObservation.Kind !=
			semantics.KindCommitment {

			return ErrInvalidContextCheckpoint
		}

		if c.LatestCommitmentTurn == nil {
			return ErrInvalidContextCheckpoint
		}

		if c.LatestCommitmentTurn.MeetingID !=
			c.MeetingID {

			return ErrInvalidContextCheckpoint
		}
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
