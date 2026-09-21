package meetingactor

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type PreparedEvidence struct {
	Turn evidence.Turn

	Observations []semantics.Observation
}

func (a *Actor) PrepareEvidence(
	ctx context.Context,
	payload string,
) (
	PreparedEvidence,
	error,
) {
	if err :=
		evidence.ValidateTurnPayloadResourceLimits(
			payload,
		); err != nil {

		return PreparedEvidence{},
			fmt.Errorf(
				"evidence payload violates resource limits: %w",
				err,
			)
	}

	var turn evidence.Turn

	if err :=
		json.Unmarshal(
			[]byte(
				payload,
			),
			&turn,
		); err != nil {

		return PreparedEvidence{},
			fmt.Errorf(
				"decode evidence turn: %w",
				err,
			)
	}

	if turn.MeetingID !=
		a.meetingID {

		return PreparedEvidence{},
			fmt.Errorf(
				"meeting mismatch: expected %q, got %q",
				a.meetingID,
				turn.MeetingID,
			)
	}

	if turn.SchemaVersion !=
		evidence.SchemaVersion {

		return PreparedEvidence{},
			fmt.Errorf(
				"unsupported evidence schema version: %d",
				turn.SchemaVersion,
			)
	}

	if err :=
		evidence.ValidateTurnResourceLimits(
			turn,
		); err != nil {

		return PreparedEvidence{},
			fmt.Errorf(
				"evidence turn violates resource limits: %w",
				err,
			)
	}

	a.logger.Info(
		"meeting actor accepted evidence",
		"meetingId",
		turn.MeetingID,
		"eventId",
		turn.EventID,
		"participantId",
		turn.ParticipantID,
		"turnOrder",
		turn.TurnOrder,
	)

	input :=
		semantics.NewEvidenceContext(
			a.previousTurn,
			turn,
		)

	extractionStarted :=
		time.Now()

	candidates, err :=
		semantics.ExtractWithContext(
			ctx,
			a.extractor,
			input,
		)

	extractionDuration :=
		time.Since(
			extractionStarted,
		)

	if a.metrics != nil {
		a.metrics.ObserveSemanticExtraction(
			extractionDuration,
		)
	}

	if err != nil {
		if a.metrics != nil {
			a.metrics.IncFailure(
				"meeting_actor",
				"semantic_extraction",
			)
		}

		return PreparedEvidence{},
			fmt.Errorf(
				"extract semantics: %w",
				err,
			)
	}

	if err :=
		validateSemanticCandidateCount(
			len(candidates),
		); err != nil {

		return PreparedEvidence{},
			fmt.Errorf(
				"validate semantic extraction size: %w",
				err,
			)
	}

	observations :=
		make(
			[]semantics.Observation,
			0,
			len(candidates),
		)

	for _, candidate := range candidates {

		observation, ok, err :=
			a.buildObservation(
				candidate,
				input,
			)

		if err != nil {
			a.logger.Warn(
				"semantic candidate rejected",
				"meetingId",
				turn.MeetingID,
				"eventId",
				turn.EventID,
				"kind",
				candidate.Kind,
				"refinesPrevious",
				candidate.RefinesPrevious,
				"error",
				err,
			)

			continue
		}

		if !ok {
			continue
		}

		observations =
			append(
				observations,
				observation,
			)

		a.logger.Info(
			"semantic observation prepared",
			"meetingId",
			a.meetingID,
			"observationId",
			observation.ID,
			"kind",
			observation.Kind,
			"summary",
			observation.Summary,
			"owner",
			observation.Owner,
			"dueText",
			observation.DueText,
			"supersedesObservationId",
			observation.SupersedesObservationID,
			"confidence",
			observation.Confidence,
		)
	}

	return PreparedEvidence{
		Turn: turn,

		Observations: append(
			[]semantics.Observation(nil),
			observations...,
		),
	}, nil
}

func (p PreparedEvidence) ContextCheckpoint(
	evidenceStreamID string,
) ContextCheckpoint {
	return ContextCheckpoint{
		SchemaVersion: ContextCheckpointSchemaVersion,

		MeetingID: p.Turn.MeetingID,

		EvidenceStreamID: evidenceStreamID,

		Turn: p.Turn,

		Observations: append(
			[]semantics.Observation(nil),
			p.Observations...,
		),
	}
}

func (a *Actor) commitPrepared(
	prepared PreparedEvidence,
) {
	turnCopy :=
		prepared.Turn

	a.previousTurn =
		&turnCopy

	a.previousObservations =
		append(
			[]semantics.Observation(nil),
			prepared.Observations...,
		)
}
