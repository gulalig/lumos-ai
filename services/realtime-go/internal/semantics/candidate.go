package semantics

import "lumos/realtime-go/internal/evidence"

// Candidate is untrusted semantic output.
//
// It may come from an LLM and therefore MUST pass
// grounding and domain validation before becoming
// a trusted Observation.
type Candidate struct {
	Kind Kind `json:"kind"`

	Summary string `json:"summary"`
	Owner   string `json:"owner"`
	DueText string `json:"dueText"`

	Explicit bool `json:"explicit"`

	// RefinesPrevious may only be true when bounded
	// previous evidence was supplied and the current
	// turn materially completes or corrects an
	// observation from that previous turn.
	RefinesPrevious bool `json:"refinesPrevious"`

	Confidence float64 `json:"confidence"`
}

func (c Candidate) ToObservation(
	turn evidence.Turn,
) (Observation, error) {
	return NewObservation(
		c.Kind,
		turn.EventID,
		turn.Text,
		c.Summary,
		c.Owner,
		c.DueText,
		c.Explicit,
		c.Confidence,
	)
}

func (c Candidate) ToContextObservation(
	input EvidenceContext,
	supersedesObservationID string,
) (Observation, error) {
	supportingEventIDs :=
		[]string{
			input.Current.EventID,
		}

	if input.Previous != nil {
		supportingEventIDs =
			[]string{
				input.Previous.EventID,
				input.Current.EventID,
			}
	}

	return NewObservationWithContext(
		c.Kind,
		input.Current.EventID,
		supportingEventIDs,
		input.GroundingText(),
		c.Summary,
		c.Owner,
		c.DueText,
		c.Explicit,
		c.Confidence,
		supersedesObservationID,
	)
}
