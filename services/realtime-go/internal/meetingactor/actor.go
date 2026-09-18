package meetingactor

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type Actor struct {
	meetingID string

	extractor semantics.Extractor
	publisher SemanticPublisher

	logger *slog.Logger
}

type SemanticPublisher interface {
	Publish(
		ctx context.Context,
		meetingID string,
		observation semantics.Observation,
	) (string, error)
}

func New(
	meetingID string,
	extractor semantics.Extractor,
	publisher SemanticPublisher,
	logger *slog.Logger,
) *Actor {
	return &Actor{
		meetingID: meetingID,
		extractor: extractor,
		publisher: publisher,
		logger:    logger,
	}
}

func (a *Actor) HandleEvidence(
	ctx context.Context,
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

	candidates, err := a.extractor.Extract(
		ctx,
		turn,
	)
	if err != nil {
		return fmt.Errorf(
			"extract semantics: %w",
			err,
		)
	}

	for _, candidate := range candidates {
		// Grounding validation happens before the candidate
		// is allowed to become a trusted domain observation.
		if err := semantics.ValidateGrounding(
			candidate,
			turn.Text,
		); err != nil {
			a.logger.Warn(
				"semantic candidate failed grounding",
				"meetingId", turn.MeetingID,
				"eventId", turn.EventID,
				"kind", candidate.Kind,
				"error", err,
			)

			continue
		}

		observation, err :=
			candidate.ToObservation(turn)

		if err != nil {
			// Fail closed.
			//
			// Invalid LLM semantic output must not become
			// domain state, but it also must not poison the
			// evidence queue forever.
			a.logger.Warn(
				"semantic candidate rejected",
				"meetingId", turn.MeetingID,
				"eventId", turn.EventID,
				"kind", candidate.Kind,
				"error", err,
			)

			continue
		}

		streamID, err := a.publisher.Publish(
			ctx,
			a.meetingID,
			observation,
		)
		if err != nil {
			return fmt.Errorf(
				"publish semantic observation: %w",
				err,
			)
		}

		a.logger.Info(
			"semantic observation published",
			"meetingId", a.meetingID,
			"observationId", observation.ID,
			"kind", observation.Kind,
			"summary", observation.Summary,
			"owner", observation.Owner,
			"dueText", observation.DueText,
			"confidence", observation.Confidence,
			"streamId", streamID,
		)
	}

	return nil
}
