package intervention

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	media "github.com/livekit/media-sdk"

	"lumos/realtime-go/internal/speechfloor"
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
	floor  *speechfloor.Floor
	valid  func(context.Context, Event) error
}

type preparedTTSSpeech struct {
	speaker           *TTSSpeaker
	event             Event
	frames            []media.PCM16Sample
	audio             tts.Audio
	startedAt         time.Time
	synthesisDuration time.Duration
	frameDuration     time.Duration
}

// Coordinate installs the runtime floor and authoritative Redis gap check.
func (s *TTSSpeaker) Coordinate(floor *speechfloor.Floor, valid func(context.Context, Event) error) {
	s.floor, s.valid = floor, valid
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
	prepared, err := s.Prepare(ctx, event)
	if err != nil {
		return err
	}
	return prepared.Speak(ctx, event)
}

func (s *TTSSpeaker) Prepare(ctx context.Context, event Event) (Speaker, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if err := event.Validate(); err != nil {
		return nil, fmt.Errorf(
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
		return nil, fmt.Errorf(
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
		return nil, fmt.Errorf(
			"convert TTS PCM to LiveKit frames: %w",
			err,
		)
	}

	if len(frames) == 0 {
		return nil, fmt.Errorf(
			"TTS produced no LiveKit PCM frames",
		)
	}

	return &preparedTTSSpeech{
		speaker: s, event: event, frames: frames, audio: audio,
		startedAt: totalStarted, synthesisDuration: synthesisDuration, frameDuration: frameDuration,
	}, nil
}

func (p *preparedTTSSpeech) Speak(ctx context.Context, event Event) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if event.ID != p.event.ID || event.MeetingID != p.event.MeetingID || event.Message != p.event.Message {
		return fmt.Errorf("prepared speech belongs to another intervention")
	}
	s := p.speaker
	publishStarted :=
		time.Now()

	// Synthesize first; audio starts only after the room becomes quiet.
	if s.floor != nil {
		playbackCtx, release, err := s.floor.Acquire(ctx, func(checkCtx context.Context) error {
			if s.valid != nil {
				return s.valid(checkCtx, event)
			}
			return nil
		})
		if err != nil {
			return err
		}
		defer release()
		ctx = playbackCtx
	}

	if err :=
		s.publisher.Publish(
			ctx,
			p.frames,
		); err != nil {
		return fmt.Errorf(
			"publish TTS audio to LiveKit: %w",
			speechfloor.CancellationError(ctx, err),
		)
	}
	if err := ctx.Err(); err != nil {
		return speechfloor.CancellationError(ctx, err)
	}

	publishDuration :=
		time.Since(
			publishStarted,
		)

	totalDuration :=
		time.Since(
			p.startedAt,
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
		p.audio.Provider,
		"language",
		p.audio.Language,
		"voice",
		p.audio.Voice,
		"characters",
		p.audio.Characters,
		"attempts",
		p.audio.Attempts,
		"frames",
		len(p.frames),
		"synthesisMs",
		p.synthesisDuration.Milliseconds(),
		"frameMs",
		p.frameDuration.Milliseconds(),
		"publishAndPlayoutMs",
		publishDuration.Milliseconds(),
		"totalMs",
		totalDuration.Milliseconds(),
	)

	return nil
}
