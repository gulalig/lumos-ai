package meetingstate

import (
	"errors"
	"fmt"
	"strings"

	"lumos/realtime-go/internal/semantics"
)

var (
	ErrMissingMeetingID = errors.New(
		"meeting id is required",
	)

	ErrSupersededObservationNotFound = errors.New(
		"superseded observation was not found in current meeting state",
	)

	ErrSupersededKindMismatch = errors.New(
		"superseded observation kind does not match replacement kind",
	)
)

type Item struct {
	ID string `json:"id"`

	Kind semantics.Kind `json:"kind"`

	Summary string `json:"summary"`
	Owner   string `json:"owner,omitempty"`
	DueText string `json:"dueText,omitempty"`

	EvidenceEventID string `json:"evidenceEventId"`

	SupportingEvidenceEventIDs []string `json:"supportingEvidenceEventIds,omitempty"`

	EvidenceText string `json:"evidenceText"`

	SupersedesObservationID string `json:"supersedesObservationId,omitempty"`

	Confidence float64 `json:"confidence"`
}

type State struct {
	MeetingID string `json:"meetingId"`
	Version   uint64 `json:"version"`

	Decisions   []Item `json:"decisions"`
	Commitments []Item `json:"commitments"`
	Proposals   []Item `json:"proposals"`
	Questions   []Item `json:"questions"`

	applied map[string]struct{}
}

func New(
	meetingID string,
) (*State, error) {
	meetingID = strings.TrimSpace(meetingID)

	if meetingID == "" {
		return nil, ErrMissingMeetingID
	}

	return &State{
		MeetingID: meetingID,

		Decisions:   make([]Item, 0),
		Commitments: make([]Item, 0),
		Proposals:   make([]Item, 0),
		Questions:   make([]Item, 0),

		applied: make(map[string]struct{}),
	}, nil
}

func (s *State) Apply(
	observation semantics.Observation,
) (bool, error) {
	if err := observation.Validate(); err != nil {
		return false, err
	}

	if observation.Kind == semantics.KindUnknown {
		return false, nil
	}

	if _, exists := s.applied[observation.ID]; exists {
		return false, nil
	}

	if observation.SupersedesObservationID != "" {
		if err := s.removeSupersededObservation(
			observation.SupersedesObservationID,
			observation.Kind,
		); err != nil {
			return false, err
		}
	}

	item := Item{
		ID:   observation.ID,
		Kind: observation.Kind,

		Summary: observation.Summary,
		Owner:   observation.Owner,
		DueText: observation.DueText,

		EvidenceEventID: observation.EvidenceEventID,

		SupportingEvidenceEventIDs: append(
			[]string(nil),
			observation.SupportingEvidenceEventIDs...,
		),

		EvidenceText: observation.EvidenceText,

		SupersedesObservationID: observation.SupersedesObservationID,

		Confidence: observation.Confidence,
	}

	switch observation.Kind {
	case semantics.KindDecision:
		s.Decisions = append(
			s.Decisions,
			item,
		)

	case semantics.KindCommitment:
		s.Commitments = append(
			s.Commitments,
			item,
		)

	case semantics.KindProposal:
		s.Proposals = append(
			s.Proposals,
			item,
		)

	case semantics.KindQuestion:
		s.Questions = append(
			s.Questions,
			item,
		)

	default:
		return false, semantics.ErrUnsupportedKind
	}

	s.applied[observation.ID] = struct{}{}

	// Version tracks accepted semantic events,
	// not the number of currently visible items.
	//
	// A revision therefore increments Version even
	// though it replaces an older visible item.
	s.Version++

	return true, nil
}

func (s *State) removeSupersededObservation(
	observationID string,
	replacementKind semantics.Kind,
) error {
	observationID = strings.TrimSpace(
		observationID,
	)

	if observationID == "" {
		return fmt.Errorf(
			"%w: empty observation id",
			ErrSupersededObservationNotFound,
		)
	}

	existingKind, found := s.findObservationKind(
		observationID,
	)

	if !found {
		return fmt.Errorf(
			"%w: %s",
			ErrSupersededObservationNotFound,
			observationID,
		)
	}

	if existingKind != replacementKind {
		return fmt.Errorf(
			"%w: previous=%q replacement=%q",
			ErrSupersededKindMismatch,
			existingKind,
			replacementKind,
		)
	}

	switch existingKind {
	case semantics.KindDecision:
		s.Decisions = removeItemByID(
			s.Decisions,
			observationID,
		)

	case semantics.KindCommitment:
		s.Commitments = removeItemByID(
			s.Commitments,
			observationID,
		)

	case semantics.KindProposal:
		s.Proposals = removeItemByID(
			s.Proposals,
			observationID,
		)

	case semantics.KindQuestion:
		s.Questions = removeItemByID(
			s.Questions,
			observationID,
		)

	default:
		return semantics.ErrUnsupportedKind
	}

	return nil
}

func (s *State) findObservationKind(
	observationID string,
) (semantics.Kind, bool) {
	for _, item := range s.Decisions {
		if item.ID == observationID {
			return item.Kind, true
		}
	}

	for _, item := range s.Commitments {
		if item.ID == observationID {
			return item.Kind, true
		}
	}

	for _, item := range s.Proposals {
		if item.ID == observationID {
			return item.Kind, true
		}
	}

	for _, item := range s.Questions {
		if item.ID == observationID {
			return item.Kind, true
		}
	}

	return "", false
}

func removeItemByID(
	items []Item,
	observationID string,
) []Item {
	for index, item := range items {
		if item.ID != observationID {
			continue
		}

		return append(
			items[:index],
			items[index+1:]...,
		)
	}

	return items
}
