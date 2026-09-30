package intervention

import "context"

type Speaker interface {
	Speak(
		ctx context.Context,
		event Event,
	) error
}

// PreparingSpeaker prepares audio once per in-flight durable delivery. The
// returned speaker can retry floor acquisition/playback without another TTS
// network round trip. Preparation failures remain ordinary delivery failures.
type PreparingSpeaker interface {
	Prepare(context.Context, Event) (Speaker, error)
}
