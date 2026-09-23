package intervention

import "context"

type Speaker interface {
	Speak(
		ctx context.Context,
		event Event,
	) error
}
