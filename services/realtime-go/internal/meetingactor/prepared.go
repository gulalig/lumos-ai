package meetingactor

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
)

type PreparedEvidence struct {
	Turn evidence.Turn

	Observations []semantics.Observation

	LatestCommitmentTurn *evidence.Turn

	LatestCommitmentObservation *semantics.Observation
	OpenCommitments             []CommitmentContext
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

	if !input.HasPrevious() && a.hasSingleOwnerlessCommitment() {
		input = semantics.NewOwnershipRefinementContext(a.previousTurn, turn)
	}

	// Select from open semantic lineages, independent of conversational turns,
	// speaker switches, or the new track/session used for each demo WAV.
	dueCommitment := a.singleMissingDueCommitment(turn)
	continuity := a.responsibilityContinuity(turn)
	if dueCommitment != nil {
		input = contextForCommitment(dueCommitment, turn)
	} else if continuity != nil {
		input = contextForCommitment(continuity, turn)
	} else if _, shortAnswer := semantics.DeadlineAnswer(turn.Text); shortAnswer {
		input = semantics.EvidenceContext{Current: turn}
	}
	if input.PreviousCommitment == nil {
		input.PreviousCommitment = a.commitmentObservationForInput(input)
	}

	extractionStarted :=
		time.Now()

	if err := ctx.Err(); err != nil {
		return PreparedEvidence{}, err
	}
	var candidates []semantics.Candidate
	var err error
	// Literal deadline answers with one target are deterministic field patches.
	// No model round trip is needed before resolving the intervention.
	if due, shortAnswer := semantics.DeadlineAnswer(turn.Text); shortAnswer {
		if dueCommitment != nil {
			previous := dueCommitment.Observation
			candidates = []semantics.Candidate{{Kind: semantics.KindCommitment, Summary: previous.Summary,
				Owner: previous.Owner, DueText: due, Explicit: true, RefinesPrevious: true, Confidence: previous.Confidence}}
		}
		// A deadline alone cannot create an action, including when no
		// eligible target exists or multiple commitments make it ambiguous.
	} else {
		candidates, err = semantics.ExtractWithContext(ctx, a.extractor, input)
	}

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
		if continuity != nil && candidate.Kind == semantics.KindCommitment && candidate.Explicit {
			candidate.RefinesPrevious = true
		}

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

	latestCommitmentTurn :=
		a.latestCommitmentTurn

	latestCommitmentObservation :=
		a.latestCommitmentObservation

	for _, observation := range observations {

		if observation.Kind !=
			semantics.KindCommitment {

			continue
		}

		turnCopy :=
			turn

		observationCopy :=
			observation

		latestCommitmentTurn =
			&turnCopy

		latestCommitmentObservation =
			&observationCopy
	}

	return PreparedEvidence{
		Turn: turn,

		Observations: append(
			[]semantics.Observation(nil),
			observations...,
		),

		LatestCommitmentTurn: latestCommitmentTurn,

		LatestCommitmentObservation: latestCommitmentObservation,
		OpenCommitments:             a.nextOpenCommitments(turn, observations),
	}, nil
}

func (p PreparedEvidence) ContextCheckpoint(
	evidenceStreamID string,
) ContextCheckpoint {
	checkpoint :=
		ContextCheckpoint{
			SchemaVersion: ContextCheckpointSchemaVersion,

			MeetingID: p.Turn.MeetingID,

			EvidenceStreamID: evidenceStreamID,

			Turn: p.Turn,

			Observations: append(
				[]semantics.Observation(nil),
				p.Observations...,
			),
		}

	if p.LatestCommitmentTurn != nil {
		turnCopy :=
			*p.LatestCommitmentTurn

		checkpoint.LatestCommitmentTurn =
			&turnCopy
	}

	if p.LatestCommitmentObservation != nil {
		observationCopy :=
			*p.LatestCommitmentObservation

		checkpoint.LatestCommitmentObservation =
			&observationCopy
	}

	checkpoint.OpenCommitments = append([]CommitmentContext{}, p.OpenCommitments...)
	return checkpoint
}

func (a *Actor) commitPrepared(
	prepared PreparedEvidence,
) {
	a.openCommitments = append([]CommitmentContext{}, prepared.OpenCommitments...)
	turnCopy :=
		prepared.Turn

	a.previousTurn =
		&turnCopy

	a.previousObservations =
		append(
			[]semantics.Observation(nil),
			prepared.Observations...,
		)

	if prepared.LatestCommitmentTurn != nil {
		turnCopy :=
			*prepared.LatestCommitmentTurn

		a.latestCommitmentTurn =
			&turnCopy
	}

	if prepared.LatestCommitmentObservation != nil {
		observationCopy :=
			*prepared.LatestCommitmentObservation

		a.latestCommitmentObservation =
			&observationCopy
	}
}

func (a *Actor) hasSingleCommitmentMissingDueDate() bool {
	if len(
		a.previousObservations,
	) != 1 {

		return false
	}

	previous :=
		a.previousObservations[0]

	if previous.Kind !=
		semantics.KindCommitment {

		return false
	}

	if strings.TrimSpace(
		previous.Owner,
	) == "" {

		return false
	}

	return strings.TrimSpace(
		previous.DueText,
	) == ""
}

func (a *Actor) hasLatestCommitmentMissingDueDate() bool {
	if a.latestCommitmentTurn == nil ||
		a.latestCommitmentObservation == nil {

		return false
	}

	commitment :=
		a.latestCommitmentObservation

	if commitment.Kind !=
		semantics.KindCommitment {

		return false
	}

	if strings.TrimSpace(
		commitment.Owner,
	) == "" {

		return false
	}

	return strings.TrimSpace(
		commitment.DueText,
	) == ""
}
