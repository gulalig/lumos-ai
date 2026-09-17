package semantics

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

type Kind string

const (
	KindUnknown    Kind = "unknown"
	KindProposal   Kind = "proposal"
	KindDecision   Kind = "decision"
	KindCommitment Kind = "commitment"
	KindQuestion   Kind = "question"
)

var (
	ErrMissingEvidenceID = errors.New(
		"evidence event id is required",
	)

	ErrMissingSummary = errors.New(
		"semantic summary is required",
	)

	ErrMissingOwner = errors.New(
		"explicit commitment requires an owner",
	)

	ErrImplicitCommitment = errors.New(
		"implicit statement cannot become a commitment",
	)

	ErrImplicitDecision = errors.New(
		"implicit statement cannot become a decision",
	)

	ErrInvalidConfidence = errors.New(
		"confidence must be between 0 and 1",
	)

	ErrUnsupportedKind = errors.New(
		"unsupported semantic kind",
	)
)

type Observation struct {
	ID string `json:"id"`

	Kind Kind `json:"kind"`

	EvidenceEventID string `json:"evidenceEventId"`
	EvidenceText    string `json:"evidenceText"`

	Summary string `json:"summary,omitempty"`
	Owner   string `json:"owner,omitempty"`
	DueText string `json:"dueText,omitempty"`

	Explicit   bool    `json:"explicit"`
	Confidence float64 `json:"confidence"`
}

func NewObservation(
	kind Kind,
	evidenceEventID string,
	evidenceText string,
	summary string,
	owner string,
	dueText string,
	explicit bool,
	confidence float64,
) (Observation, error) {
	observation := Observation{
		Kind: kind,

		EvidenceEventID: strings.TrimSpace(
			evidenceEventID,
		),

		EvidenceText: strings.TrimSpace(
			evidenceText,
		),

		Summary: strings.TrimSpace(summary),
		Owner:   strings.TrimSpace(owner),
		DueText: strings.TrimSpace(dueText),

		Explicit:   explicit,
		Confidence: confidence,
	}

	if err := observation.Validate(); err != nil {
		return Observation{}, err
	}

	observation.ID = createObservationID(
		observation,
	)

	return observation, nil
}

func (o Observation) Validate() error {
	if o.EvidenceEventID == "" {
		return ErrMissingEvidenceID
	}

	if o.Confidence < 0 ||
		o.Confidence > 1 {
		return ErrInvalidConfidence
	}

	switch o.Kind {
	case KindUnknown:
		return nil

	case KindProposal,
		KindQuestion:
		if o.Summary == "" {
			return ErrMissingSummary
		}

		return nil

	case KindDecision:
		if o.Summary == "" {
			return ErrMissingSummary
		}

		if !o.Explicit {
			return ErrImplicitDecision
		}

		return nil

	case KindCommitment:
		if o.Summary == "" {
			return ErrMissingSummary
		}

		if !o.Explicit {
			return ErrImplicitCommitment
		}

		if o.Owner == "" {
			return ErrMissingOwner
		}

		return nil

	default:
		return fmt.Errorf(
			"%w: %q",
			ErrUnsupportedKind,
			o.Kind,
		)
	}
}

func createObservationID(
	observation Observation,
) string {
	hash := sha256.New()

	values := []string{
		observation.EvidenceEventID,
		string(observation.Kind),
		observation.Summary,
		observation.Owner,
		observation.DueText,
	}

	for _, value := range values {
		_, _ = hash.Write([]byte(value))
		_, _ = hash.Write([]byte{0})
	}

	return hex.EncodeToString(
		hash.Sum(nil),
	)
}
