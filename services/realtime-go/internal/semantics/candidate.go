package semantics

import "lumos/realtime-go/internal/evidence"

// Candidate is untrusted semantic output.
//
// It may come from an LLM and therefore MUST pass domain
// validation before becoming an Observation.
type Candidate struct {
	Kind Kind `json:"kind"`

	Summary string `json:"summary"`
	Owner   string `json:"owner"`
	DueText string `json:"dueText"`

	Explicit   bool    `json:"explicit"`
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
