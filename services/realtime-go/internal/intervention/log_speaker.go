package intervention

import (
	"context"
	"fmt"
	"log/slog"
)

type LogSpeaker struct {
	logger *slog.Logger
}

func NewLogSpeaker(
	logger *slog.Logger,
) *LogSpeaker {
	if logger == nil {
		logger = slog.Default()
	}

	return &LogSpeaker{
		logger: logger,
	}
}

func (s *LogSpeaker) Speak(
	ctx context.Context,
	event Event,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	if err := event.Validate(); err != nil {
		return fmt.Errorf(
			"validate intervention before speaking: %w",
			err,
		)
	}

	s.logger.Info(
		"intervention speak requested",
		"meetingId", event.MeetingID,
		"eventId", event.ID,
		"gapId", event.GapID,
		"reason", event.Reason,
		"message", event.Message,
	)

	return nil
}
