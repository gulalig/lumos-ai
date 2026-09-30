package meetingactor

import (
	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/semantics"
	"strings"
)

type CommitmentContext struct {
	Turn        evidence.Turn         `json:"turn"`
	Observation semantics.Observation `json:"observation"`
}

func (a *Actor) commitmentContexts() []CommitmentContext {
	if a.openCommitments != nil {
		return a.openCommitments
	}
	// Read older durable checkpoints without discarding their latest target.
	if a.latestCommitmentTurn != nil && a.latestCommitmentObservation != nil {
		return []CommitmentContext{{Turn: *a.latestCommitmentTurn, Observation: *a.latestCommitmentObservation}}
	}
	var result []CommitmentContext
	for _, observation := range a.previousObservations {
		if observation.Kind == semantics.KindCommitment && a.previousTurn != nil {
			result = append(result, CommitmentContext{Turn: *a.previousTurn, Observation: observation})
		}
	}
	return result
}

func (a *Actor) singleMissingDueCommitment(current evidence.Turn) *CommitmentContext {
	var selected *CommitmentContext
	for _, commitment := range a.commitmentContexts() {
		if strings.TrimSpace(commitment.Observation.DueText) != "" {
			continue
		}
		// Even an ownerless second obligation makes a short answer ambiguous.
		if selected != nil {
			return nil
		}
		copy := commitment
		selected = &copy
	}
	if selected == nil || strings.TrimSpace(selected.Observation.Owner) == "" {
		return nil
	}
	if _, shortAnswer := semantics.DeadlineAnswer(current.Text); shortAnswer {
		// A single durable open lineage is the clarification target, even
		// after a long pause or unrelated intervening turns. Conversational
		// adjacency expiry must not silently discard its missing field.
		previous := selected.Turn
		if previous.MeetingID != current.MeetingID || previous.EventID == current.EventID ||
			previous.CapturedAt.IsZero() || current.CapturedAt.IsZero() ||
			current.CapturedAt.Before(previous.CapturedAt) {
			return nil
		}
		return selected
	}
	if !semantics.NewDueDateRefinementContext(&selected.Turn, current).HasPrevious() {
		return nil
	}
	return selected
}

func (a *Actor) responsibilityContinuity(current evidence.Turn) *CommitmentContext {
	var selected *CommitmentContext
	for _, commitment := range a.commitmentContexts() {
		gap := current.CapturedAt.Sub(commitment.Turn.CapturedAt)
		if gap < 0 || gap > semantics.MaxRefinementTurnGap ||
			commitment.Turn.ParticipantID != current.ParticipantID ||
			!strings.EqualFold(commitment.Observation.Owner, current.ParticipantID) ||
			!semantics.SameResponsibility(commitment.Turn.Text, current.Text) {
			continue
		}
		if selected != nil {
			return nil
		}
		copy := commitment
		selected = &copy
	}
	return selected
}

func contextForCommitment(commitment *CommitmentContext, current evidence.Turn) semantics.EvidenceContext {
	previous := commitment.Turn
	// Later turns may be fragments. Retain the original action evidence.
	previous.Text = commitment.Observation.EvidenceText
	observation := commitment.Observation
	return semantics.EvidenceContext{Previous: &previous, Current: current, PreviousCommitment: &observation}
}

func (a *Actor) nextOpenCommitments(turn evidence.Turn, observations []semantics.Observation) []CommitmentContext {
	result := append([]CommitmentContext{}, a.commitmentContexts()...)
	for _, observation := range observations {
		if observation.Kind != semantics.KindCommitment {
			continue
		}
		for i := 0; i < len(result); i++ {
			if result[i].Observation.ID == observation.SupersedesObservationID {
				result = append(result[:i], result[i+1:]...)
				break
			}
		}
		if observation.Owner == "" || observation.DueText == "" {
			result = append(result, CommitmentContext{Turn: turn, Observation: observation})
		}
	}
	return result
}
