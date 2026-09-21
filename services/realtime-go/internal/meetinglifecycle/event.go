package meetinglifecycle

import (
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const StreamName = "lumos:meetings:lifecycle"

type EventType string

const (
	EventTypeStarted EventType = "meeting.started.v1"
	EventTypeEnded   EventType = "meeting.ended.v1"
)

type Event struct {
	StreamID string

	Type EventType

	EventID string

	MeetingID string
	RoomName  string

	OccurredAt time.Time
}

type ActiveMeeting struct {
	MeetingID string
	RoomName  string
}

func (t EventType) IsKnown() bool {
	switch t {
	case EventTypeStarted,
		EventTypeEnded:
		return true

	default:
		return false
	}
}

func ParseMessage(
	message redis.XMessage,
) (Event, error) {
	eventTypeRaw, err := requiredString(
		message.Values,
		"type",
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s: %w",
			message.ID,
			err,
		)
	}

	eventType := EventType(
		eventTypeRaw,
	)

	// Forward compatibility:
	// old services ignore lifecycle event versions
	// they do not understand.
	if !eventType.IsKnown() {
		return Event{
			StreamID: message.ID,
			Type:     eventType,
		}, nil
	}

	eventID, err := requiredString(
		message.Values,
		"eventId",
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s: %w",
			message.ID,
			err,
		)
	}

	meetingID, err := requiredString(
		message.Values,
		"meetingId",
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s: %w",
			message.ID,
			err,
		)
	}

	roomName, err := requiredString(
		message.Values,
		"roomName",
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s: %w",
			message.ID,
			err,
		)
	}

	occurredAtRaw, err := requiredString(
		message.Values,
		"occurredAt",
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s: %w",
			message.ID,
			err,
		)
	}

	occurredAt, err := time.Parse(
		time.RFC3339Nano,
		occurredAtRaw,
	)
	if err != nil {
		return Event{}, fmt.Errorf(
			"lifecycle event %s invalid occurredAt: %w",
			message.ID,
			err,
		)
	}

	return Event{
		StreamID: message.ID,

		Type: eventType,

		EventID: eventID,

		MeetingID: meetingID,
		RoomName:  roomName,

		OccurredAt: occurredAt,
	}, nil
}

func requiredString(
	values map[string]any,
	key string,
) (string, error) {
	value, exists := values[key]
	if !exists {
		return "", fmt.Errorf(
			"missing %q",
			key,
		)
	}

	result := strings.TrimSpace(
		streamString(value),
	)

	if result == "" {
		return "", fmt.Errorf(
			"%q is empty",
			key,
		)
	}

	return result, nil
}

func streamString(
	value any,
) string {
	switch typed := value.(type) {
	case string:
		return typed

	case []byte:
		return string(typed)

	case fmt.Stringer:
		return typed.String()

	default:
		return fmt.Sprint(value)
	}
}
