package livekitclient

import (
	"context"
	"fmt"

	media "github.com/livekit/media-sdk"
	livekit "github.com/livekit/protocol/livekit"
	protoLogger "github.com/livekit/protocol/logger"
	lksdk "github.com/livekit/server-sdk-go/v2"
	lkmedia "github.com/livekit/server-sdk-go/v2/pkg/media"
)

type PCMAudioPublisher struct {
	room *lksdk.Room

	sampleRate int
	channels   int
}

func NewPCMAudioPublisher(
	room *lksdk.Room,
	sampleRate int,
	channels int,
) (*PCMAudioPublisher, error) {
	if room == nil {
		return nil, fmt.Errorf(
			"livekit audio publisher room is required",
		)
	}

	if sampleRate <= 0 {
		return nil, fmt.Errorf(
			"livekit audio publisher sample rate must be positive",
		)
	}

	if channels <= 0 || channels > 2 {
		return nil, fmt.Errorf(
			"livekit audio publisher channels must be 1 or 2",
		)
	}

	return &PCMAudioPublisher{
		room: room,

		sampleRate: sampleRate,
		channels:   channels,
	}, nil
}

func (p *PCMAudioPublisher) Publish(
	ctx context.Context,
	samples []media.PCM16Sample,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	if len(samples) == 0 {
		return fmt.Errorf(
			"livekit audio samples are empty",
		)
	}

	track, err :=
		lkmedia.NewPCMLocalTrack(
			p.sampleRate,
			p.channels,
			protoLogger.GetLogger(),
		)

	if err != nil {
		return fmt.Errorf(
			"create livekit PCM track: %w",
			err,
		)
	}

	closed := false

	defer func() {
		if !closed {
			_ = track.Close()
		}
	}()

	_, err =
		p.room.LocalParticipant.PublishTrack(
			track,
			&lksdk.TrackPublicationOptions{
				Name: "lumos-intervention",

				Source: livekit.TrackSource_MICROPHONE,
			},
		)

	if err != nil {
		return fmt.Errorf(
			"publish livekit PCM track: %w",
			err,
		)
	}

	for _, sample := range samples {
		if err := ctx.Err(); err != nil {
			return err
		}

		if len(sample) == 0 {
			continue
		}

		if err :=
			track.WriteSample(
				sample,
			); err != nil {

			return fmt.Errorf(
				"write livekit PCM sample: %w",
				err,
			)
		}
	}

	if err := track.Close(); err != nil {
		return fmt.Errorf(
			"close livekit PCM track: %w",
			err,
		)
	}

	closed = true

	return nil
}
