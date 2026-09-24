package intervention

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	media "github.com/livekit/media-sdk"

	"lumos/realtime-go/internal/tts"
)

type PCMAudioPublisher interface {
	Publish(
		ctx context.Context,
		samples []media.PCM16Sample,
	) error
}

type TTSSpeaker struct {
	provider tts.Provider

	publisher PCMAudioPublisher

	logger *slog.Logger
}

func NewTTSSpeaker(
	provider tts.Provider,
	publisher PCMAudioPublisher,
	logger *slog.Logger,
) (*TTSSpeaker, error) {
	if provider == nil {
		return nil, fmt.Errorf(
			"TTS speaker provider is required",
		)
	}

	if publisher == nil {
		return nil, fmt.Errorf(
			"TTS speaker audio publisher is required",
		)
	}

	if logger == nil {
		logger = slog.Default()
	}

	return &TTSSpeaker{
		provider: provider,

		publisher: publisher,

		logger: logger,
	}, nil
}

func (
	s *TTSSpeaker,
) Speak(
	ctx context.Context,
	event Event,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	if err := event.Validate(); err != nil {
		return fmt.Errorf(
			"validate intervention before TTS: %w",
			err,
		)
	}

	totalStarted :=
		time.Now()

	synthesisStarted :=
		time.Now()

	audio, err :=
		s.provider.Synthesize(
			ctx,
			event.Message,
		)

	synthesisDuration :=
		time.Since(
			synthesisStarted,
		)

	if err != nil {
		return fmt.Errorf(
			"synthesize intervention speech: %w",
			err,
		)
	}

	frameStarted :=
		time.Now()

	frames, err :=
		tts.PCM16LEToFrames(
			audio.PCM,
			audio.SampleRate,
			audio.Channels,
		)

	frameDuration :=
		time.Since(
			frameStarted,
		)

	if err != nil {
		return fmt.Errorf(
			"convert TTS PCM to LiveKit frames: %w",
			err,
		)
	}

	if len(frames) == 0 {
		return fmt.Errorf(
			"TTS produced no LiveKit PCM frames",
		)
	}

	publishStarted :=
		time.Now()

	if err :=
		s.publisher.Publish(
			ctx,
			frames,
		); err != nil {

		return fmt.Errorf(
			"publish TTS audio to LiveKit: %w",
			err,
		)
	}

	publishDuration :=
		time.Since(
			publishStarted,
		)

	totalDuration :=
		time.Since(
			totalStarted,
		)

	s.logger.Info(
		"intervention spoken",
		"meetingId",
		event.MeetingID,
		"eventId",
		event.ID,
		"gapId",
		event.GapID,
		"reason",
		event.Reason,
		"provider",
		audio.Provider,
		"language",
		audio.Language,
		"voice",
		audio.Voice,
		"characters",
		audio.Characters,
		"attempts",
		audio.Attempts,
		"frames",
		len(frames),
		"synthesisMs",
		synthesisDuration.Milliseconds(),
		"frameMs",
		frameDuration.Milliseconds(),
		"publishAndPlayoutMs",
		publishDuration.Milliseconds(),
		"totalMs",
		totalDuration.Milliseconds(),
	)

	return nil
}
