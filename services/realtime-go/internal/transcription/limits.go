package transcription

import "errors"

const (
	// Safety ceiling for one meeting runtime.
	//
	// Every active microphone track owns:
	//
	// - an RTP processing goroutine
	// - an Opus decoder
	// - PCM buffering
	// - an AssemblyAI realtime session
	//
	// Without a ceiling, one room can create an unbounded
	// amount of local and external resources.
	maxConcurrentMicrophoneTracks = 32
)

var ErrTrackLimitReached = errors.New(
	"maximum concurrent microphone track limit reached",
)

func (
	m *Manager,
) reserveTrack(
	trackID string,
	state *trackState,
) (
	bool,
	error,
) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Duplicate LiveKit subscription callbacks must remain
	// idempotent and must not consume another slot.
	if _, exists :=
		m.tracks[trackID]; exists {

		return false,
			nil
	}

	if len(m.tracks) >=
		maxConcurrentMicrophoneTracks {

		return false,
			ErrTrackLimitReached
	}

	m.tracks[trackID] =
		state

	m.updateActiveMicrophoneTracksMetricLocked()

	return true,
		nil
}
