package livekitclient

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	media "github.com/livekit/media-sdk"
	livekit "github.com/livekit/protocol/livekit"
	protoLogger "github.com/livekit/protocol/logger"
	lksdk "github.com/livekit/server-sdk-go/v2"
	lkmedia "github.com/livekit/server-sdk-go/v2/pkg/media"
	"github.com/pion/webrtc/v4"
)

type PCMAudioPublisher struct {
	room *lksdk.Room

	sampleRate int
	channels   int
}

type bindAwarePCMLocalTrack struct {
	*lkmedia.PCMLocalTrack

	boundOnce sync.Once
	boundCh   chan struct{}
}

func newBindAwarePCMLocalTrack(
	sampleRate int,
	channels int,
) (*bindAwarePCMLocalTrack, error) {
	track, err :=
		lkmedia.NewPCMLocalTrack(
			sampleRate,
			channels,
			protoLogger.GetLogger(),
		)

	if err != nil {
		return nil,
			fmt.Errorf(
				"create livekit PCM track: %w",
				err,
			)
	}

	return &bindAwarePCMLocalTrack{
		PCMLocalTrack: track,

		boundCh: make(
			chan struct{},
		),
	}, nil
}

func (
	t *bindAwarePCMLocalTrack,
) Bind(
	trackLocal webrtc.TrackLocalContext,
) (
	webrtc.RTPCodecParameters,
	error,
) {
	parameters,
		err :=
		t.PCMLocalTrack.Bind(
			trackLocal,
		)

	if err != nil {
		return parameters,
			err
	}

	t.boundOnce.Do(
		func() {
			close(
				t.boundCh,
			)
		},
	)

	return parameters,
		nil
}

func (
	t *bindAwarePCMLocalTrack,
) WaitUntilBound(
	ctx context.Context,
) error {
	select {
	case <-ctx.Done():
		return ctx.Err()

	case <-t.boundCh:
		return nil
	}
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

func (
	p *PCMAudioPublisher,
) Publish(
	ctx context.Context,
	samples []media.PCM16Sample,
) error {
	if ctx == nil {
		return fmt.Errorf(
			"livekit audio publisher context is required",
		)
	}

	if err := ctx.Err(); err != nil {
		return err
	}

	if len(samples) == 0 {
		return fmt.Errorf(
			"livekit audio samples are empty",
		)
	}

	track,
		err :=
		newBindAwarePCMLocalTrack(
			p.sampleRate,
			p.channels,
		)

	if err != nil {
		return err
	}

	closed := false

	defer func() {
		if !closed {
			_ =
				track.Close()
		}
	}()

	publishTrackStarted :=
		time.Now()

	_, err =
		p.room.
			LocalParticipant.
			PublishTrack(
				track,
				&lksdk.TrackPublicationOptions{
					Name: "lumos-intervention",

					Source: livekit.TrackSource_MICROPHONE,
				},
			)

	publishTrackDuration :=
		time.Since(
			publishTrackStarted,
		)

	if err != nil {
		return fmt.Errorf(
			"publish livekit PCM track: %w",
			err,
		)
	}

	// PublishTrack may return before the WebRTC sender has
	// actually bound the local track.
	//
	// PCMLocalTrack.WriteSample silently ignores PCM while
	// the track is not bound, so waiting here is required
	// to avoid dropping the entire intervention.
	bindStarted :=
		time.Now()

	if err :=
		track.WaitUntilBound(
			ctx,
		); err != nil {

		return fmt.Errorf(
			"wait for livekit PCM track bind: %w",
			err,
		)
	}

	bindDuration :=
		time.Since(
			bindStarted,
		)

	writeStarted :=
		time.Now()

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

	writeDuration :=
		time.Since(
			writeStarted,
		)

	playoutStarted :=
		time.Now()

	track.WaitForPlayout()

	playoutDuration :=
		time.Since(
			playoutStarted,
		)

	slog.Info(
		"livekit intervention audio timing",
		"publishTrackMs",
		publishTrackDuration.Milliseconds(),
		"bindMs",
		bindDuration.Milliseconds(),
		"writeMs",
		writeDuration.Milliseconds(),
		"playoutMs",
		playoutDuration.Milliseconds(),
		"frames",
		len(samples),
	)

	if err :=
		track.Close(); err != nil {

		return fmt.Errorf(
			"close livekit PCM track: %w",
			err,
		)
	}

	closed = true

	return nil
}
