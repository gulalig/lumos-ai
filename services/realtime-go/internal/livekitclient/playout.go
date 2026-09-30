package livekitclient

import "context"

type playoutTrack interface {
	WaitForPlayout()
	ClearQueue()
}

func waitForPlayout(ctx context.Context, track playoutTrack) error {
	done := make(chan struct{})
	go func() { track.WaitForPlayout(); close(done) }()
	select {
	case <-ctx.Done():
		track.ClearQueue()
		<-done
		return ctx.Err()
	case <-done:
		return ctx.Err()
	}
}
