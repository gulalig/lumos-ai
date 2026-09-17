package evidence

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

const (
	EventType     = "evidence.turn.final"
	SchemaVersion = 1
)

var (
	ErrMissingMeetingID     = errors.New("meeting id is required")
	ErrMissingParticipantID = errors.New("participant id is required")
	ErrMissingTrackID       = errors.New("track id is required")
	ErrEmptyText            = errors.New("evidence text is empty")
	ErrInvalidTurnOrder     = errors.New("turn order cannot be negative")
)

type Turn struct {
	SchemaVersion int       `json:"schemaVersion"`
	EventID       string    `json:"eventId"`
	MeetingID     string    `json:"meetingId"`
	ParticipantID string    `json:"participantId"`
	TrackID       string    `json:"trackId"`
	TurnOrder     int       `json:"turnOrder"`
	Text          string    `json:"text"`
	CapturedAt    time.Time `json:"capturedAt"`
}

func NewTurn(
	meetingID string,
	participantID string,
	trackID string,
	turnOrder int,
	text string,
	capturedAt time.Time,
) (Turn, error) {
	meetingID = strings.TrimSpace(meetingID)
	participantID = strings.TrimSpace(participantID)
	trackID = strings.TrimSpace(trackID)
	text = strings.TrimSpace(text)

	switch {
	case meetingID == "":
		return Turn{}, ErrMissingMeetingID

	case participantID == "":
		return Turn{}, ErrMissingParticipantID

	case trackID == "":
		return Turn{}, ErrMissingTrackID

	case turnOrder < 0:
		return Turn{}, ErrInvalidTurnOrder

	case text == "":
		return Turn{}, ErrEmptyText
	}

	if capturedAt.IsZero() {
		capturedAt = time.Now().UTC()
	} else {
		capturedAt = capturedAt.UTC()
	}

	eventID := createEventID(
		meetingID,
		participantID,
		trackID,
		turnOrder,
		text,
	)

	return Turn{
		SchemaVersion: SchemaVersion,
		EventID:       eventID,
		MeetingID:     meetingID,
		ParticipantID: participantID,
		TrackID:       trackID,
		TurnOrder:     turnOrder,
		Text:          text,
		CapturedAt:    capturedAt,
	}, nil
}

func createEventID(
	meetingID string,
	participantID string,
	trackID string,
	turnOrder int,
	text string,
) string {
	hash := sha256.New()

	writeHashPart(hash, meetingID)
	writeHashPart(hash, participantID)
	writeHashPart(hash, trackID)
	writeHashPart(hash, strconv.Itoa(turnOrder))
	writeHashPart(hash, text)

	return hex.EncodeToString(hash.Sum(nil))
}

type hashWriter interface {
	Write([]byte) (int, error)
}

func writeHashPart(
	writer hashWriter,
	value string,
) {
	_, _ = writer.Write([]byte(value))
	_, _ = writer.Write([]byte{0})
}
