package intervention

import (
	"fmt"
	"time"
)

const EventType = "intervention.requested.v1"

type Reason string

const (
	ReasonMissingOwner   Reason = "missing_owner"
	ReasonMissingDueDate Reason = "missing_due_date"
)

type Event struct {
	ID string `json:"id"`

	GapID string `json:"gapId"`

	MeetingID string `json:"meetingId"`

	SprintItemID string `json:"sprintItemId"`

	ObservationID string `json:"observationId"`

	Reason Reason `json:"reason"`

	Message string `json:"message"`

	CreatedAt time.Time `json:"createdAt"`
}

func (e Event) Validate() error {
	if e.ID == "" {
		return fmt.Errorf(
			"intervention id is required",
		)
	}

	if e.GapID == "" {
		return fmt.Errorf(
			"intervention gap id is required",
		)
	}

	if e.MeetingID == "" {
		return fmt.Errorf(
			"intervention meeting id is required",
		)
	}

	if e.SprintItemID == "" {
		return fmt.Errorf(
			"intervention sprint item id is required",
		)
	}

	if e.ObservationID == "" {
		return fmt.Errorf(
			"intervention observation id is required",
		)
	}

	switch e.Reason {
	case ReasonMissingOwner:
	case ReasonMissingDueDate:

	default:
		return fmt.Errorf(
			"unsupported intervention reason %q",
			e.Reason,
		)
	}

	if e.Message == "" {
		return fmt.Errorf(
			"intervention message is required",
		)
	}

	if e.CreatedAt.IsZero() {
		return fmt.Errorf(
			"intervention createdAt is required",
		)
	}

	return nil
}
