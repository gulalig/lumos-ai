package meetingstate

import (
	"errors"
	"strings"

	"lumos/realtime-go/internal/semantics"
)

var ErrMissingMeetingID = errors.New(
	"meeting id is required",
)

type Item struct {
	ID string `json:"id"`

	Kind semantics.Kind `json:"kind"`

	Summary string `json:"summary"`
	Owner   string `json:"owner,omitempty"`
	DueText string `json:"dueText,omitempty"`

	EvidenceEventID string `json:"evidenceEventId"`
	EvidenceText    string `json:"evidenceText"`

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

		applied: make(
			map[string]struct{},
		),
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

	item := Item{
		ID: observation.ID,

		Kind: observation.Kind,

		Summary: observation.Summary,
		Owner:   observation.Owner,
		DueText: observation.DueText,

		EvidenceEventID: observation.EvidenceEventID,
		EvidenceText:    observation.EvidenceText,

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
	s.Version++

	return true, nil
}
