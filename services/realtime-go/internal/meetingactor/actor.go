package meetingactor

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"lumos/realtime-go/internal/evidence"
)

type Actor struct {
	meetingID string
	logger    *slog.Logger
}

func New(
	meetingID string,
	logger *slog.Logger,
) *Actor {
	return &Actor{
		meetingID: meetingID,
		logger:    logger,
	}
}

func (a *Actor) HandleEvidence(
	_ context.Context,
	payload string,
) error {
	var turn evidence.Turn

	if err := json.Unmarshal(
		[]byte(payload),
		&turn,
	); err != nil {
		return fmt.Errorf(
			"decode evidence turn: %w",
			err,
		)
	}

	if turn.MeetingID != a.meetingID {
		return fmt.Errorf(
			"meeting mismatch: expected %q, got %q",
			a.meetingID,
			turn.MeetingID,
		)
	}

	if turn.SchemaVersion != evidence.SchemaVersion {
		return fmt.Errorf(
			"unsupported evidence schema version: %d",
			turn.SchemaVersion,
		)
	}

	a.logger.Info(
		"meeting actor accepted evidence",
		"meetingId", turn.MeetingID,
		"eventId", turn.EventID,
		"participantId", turn.ParticipantID,
		"turnOrder", turn.TurnOrder,
	)

	return nil
}
