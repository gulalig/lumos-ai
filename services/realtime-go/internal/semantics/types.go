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

	ErrUngroundedDecision = errors.New(
		"decision is not explicitly grounded in evidence",
	)

	ErrUngroundedOwner = errors.New(
		"commitment owner is not grounded in evidence",
	)

	ErrUngroundedDueText = errors.New(
		"deadline is not grounded in evidence",
	)
)

type Observation struct {
	ID string `json:"id"`

	Kind Kind `json:"kind"`

	// EvidenceEventID is the current / primary
	// evidence event responsible for this observation.
	EvidenceEventID string `json:"evidenceEventId"`

	// SupportingEvidenceEventIDs is populated when
	// an observation requires bounded adjacent-turn
	// evidence.
	SupportingEvidenceEventIDs []string `json:"supportingEvidenceEventIds,omitempty"`

	EvidenceText string `json:"evidenceText"`

	Summary string `json:"summary,omitempty"`
	Owner   string `json:"owner,omitempty"`
	DueText string `json:"dueText,omitempty"`

	// SupersedesObservationID makes semantic history
	// append-only while allowing the read model to
	// replace an older observation.
	SupersedesObservationID string `json:"supersedesObservationId,omitempty"`

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

func NewObservationWithContext(
	kind Kind,
	evidenceEventID string,
	supportingEvidenceEventIDs []string,
	evidenceText string,
	summary string,
	owner string,
	dueText string,
	explicit bool,
	confidence float64,
	supersedesObservationID string,
) (Observation, error) {
	observation, err :=
		NewObservation(
			kind,
			evidenceEventID,
			evidenceText,
			summary,
			owner,
			dueText,
			explicit,
			confidence,
		)

	if err != nil {
		return Observation{},
			err
	}

	observation.SupportingEvidenceEventIDs =
		normalizeEvidenceEventIDs(
			supportingEvidenceEventIDs,
		)

	observation.SupersedesObservationID =
		strings.TrimSpace(
			supersedesObservationID,
		)

	observation.ID =
		createObservationID(
			observation,
		)

	return observation,
		nil
}

func normalizeEvidenceEventIDs(
	values []string,
) []string {
	result :=
		make(
			[]string,
			0,
			len(values),
		)

	seen :=
		make(
			map[string]struct{},
			len(values),
		)

	for _, value := range values {
		value =
			strings.TrimSpace(
				value,
			)

		if value == "" {
			continue
		}

		if _, exists :=
			seen[value]; exists {
			continue
		}

		seen[value] =
			struct{}{}

		result =
			append(
				result,
				value,
			)
	}

	return result
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

		// Owner and due date are intentionally optional.
		//
		// Missing execution details are represented as
		// intervention gaps instead of invalidating the
		// semantic commitment.
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

	// Preserve IDs generated by the old schema when
	// no revision metadata exists.
	if observation.SupersedesObservationID != "" {
		values = append(
			values,
			observation.SupersedesObservationID,
		)
	}

	if len(
		observation.SupportingEvidenceEventIDs,
	) > 1 {
		values = append(
			values,
			observation.SupportingEvidenceEventIDs...,
		)
	}

	for _, value := range values {
		_, _ = hash.Write([]byte(value))
		_, _ = hash.Write([]byte{0})
	}

	return hex.EncodeToString(
		hash.Sum(nil),
	)
}
