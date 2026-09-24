package intervention

import (
	"context"
	"errors"
	"testing"
	"time"

	media "github.com/livekit/media-sdk"

	"lumos/realtime-go/internal/tts"
)

type fakeTTSProvider struct {
	audio tts.Audio
	err   error

	text string
}

func (
	f *fakeTTSProvider,
) Synthesize(
	_ context.Context,
	text string,
) (tts.Audio, error) {
	f.text = text

	if f.err != nil {
		return tts.Audio{}, f.err
	}

	return f.audio, nil
}

type fakePCMPublisher struct {
	frames []media.PCM16Sample
	err    error
}

func (
	f *fakePCMPublisher,
) Publish(
	_ context.Context,
	frames []media.PCM16Sample,
) error {
	if f.err != nil {
		return f.err
	}

	f.frames = frames

	return nil
}

func validTTSEvent() Event {
	return Event{
		ID: "intervention-1",

		GapID: "gap-1",

		MeetingID: "meeting-1",

		SprintItemID: "sprint-item-1",

		ObservationID: "observation-1",

		Reason: ReasonMissingOwner,

		Message: "Who owns this commitment?",

		CreatedAt: time.Date(
			2026,
			9,
			24,
			12,
			0,
			0,
			0,
			time.UTC,
		),
	}
}

func TestTTSSpeakerSynthesizesAndPublishes(
	t *testing.T,
) {
	t.Parallel()

	provider :=
		&fakeTTSProvider{
			audio: tts.Audio{
				PCM: []byte{
					0x01,
					0x00,
					0x02,
					0x00,
				},

				SampleRate: 22050,

				Channels: 1,

				Provider: "edge",

				Language: "en-US",

				Voice: "en-US-AriaNeural",

				Characters: 25,

				Attempts: 1,
			},
		}

	publisher :=
		&fakePCMPublisher{}

	speaker, err :=
		NewTTSSpeaker(
			provider,
			publisher,
			nil,
		)
	if err != nil {
		t.Fatalf(
			"NewTTSSpeaker returned error: %v",
			err,
		)
	}

	event :=
		validTTSEvent()

	if err :=
		speaker.Speak(
			context.Background(),
			event,
		); err != nil {

		t.Fatalf(
			"Speak returned error: %v",
			err,
		)
	}

	if provider.text != event.Message {
		t.Fatalf(
			"unexpected synthesized text: %q",
			provider.text,
		)
	}

	if len(
		publisher.frames,
	) != 1 {

		t.Fatalf(
			"expected one PCM frame, got %d",
			len(
				publisher.frames,
			),
		)
	}

	frame :=
		publisher.frames[0]

	if len(frame) != 2 {
		t.Fatalf(
			"expected two PCM samples, got %d",
			len(frame),
		)
	}

	if frame[0] != 1 ||
		frame[1] != 2 {

		t.Fatalf(
			"unexpected PCM samples: %v",
			frame,
		)
	}
}

func TestTTSSpeakerDoesNotPublishWhenSynthesisFails(
	t *testing.T,
) {
	t.Parallel()

	provider :=
		&fakeTTSProvider{
			err: errors.New(
				"TTS unavailable",
			),
		}

	publisher :=
		&fakePCMPublisher{}

	speaker, err :=
		NewTTSSpeaker(
			provider,
			publisher,
			nil,
		)
	if err != nil {
		t.Fatalf(
			"NewTTSSpeaker returned error: %v",
			err,
		)
	}

	err =
		speaker.Speak(
			context.Background(),
			validTTSEvent(),
		)

	if err == nil {
		t.Fatal(
			"expected synthesis error",
		)
	}

	if len(
		publisher.frames,
	) != 0 {

		t.Fatal(
			"audio must not be published after synthesis failure",
		)
	}
}

func TestTTSSpeakerReturnsPublishFailure(
	t *testing.T,
) {
	t.Parallel()

	provider :=
		&fakeTTSProvider{
			audio: tts.Audio{
				PCM: []byte{
					0x01,
					0x00,
				},

				SampleRate: 22050,

				Channels: 1,

				Provider: "edge",

				Language: "en-US",

				Voice: "en-US-AriaNeural",

				Characters: 25,

				Attempts: 1,
			},
		}

	publisher :=
		&fakePCMPublisher{
			err: errors.New(
				"LiveKit publish failed",
			),
		}

	speaker, err :=
		NewTTSSpeaker(
			provider,
			publisher,
			nil,
		)
	if err != nil {
		t.Fatalf(
			"NewTTSSpeaker returned error: %v",
			err,
		)
	}

	err =
		speaker.Speak(
			context.Background(),
			validTTSEvent(),
		)

	if err == nil {
		t.Fatal(
			"expected publish error",
		)
	}
}
