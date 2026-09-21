package transcription

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/pion/opus"
	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media/samplebuilder"

	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"

	"lumos/realtime-go/internal/assemblyai"
	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/observability"
)

const (
	maxLateAudioPackets = 10
	trackReadTimeout    = 1 * time.Second

	// Opus permits packets of up to 120 ms.
	// 16 kHz mono = 1,920 samples maximum.
	maxDecodedSamples = targetSampleRate * 120 / 1000
)

type trackState struct {
	cancel context.CancelFunc
}

type Manager struct {
	ctx       context.Context
	meetingID string
	assembly  *assemblyai.Client
	evidence  *evidence.Dispatcher
	logger    *slog.Logger
	metrics   *observability.Metrics

	mu     sync.Mutex
	tracks map[string]*trackState

	wg sync.WaitGroup
}

func NewManager(
	ctx context.Context,
	meetingID string,
	assembly *assemblyai.Client,
	evidenceDispatcher *evidence.Dispatcher,
	logger *slog.Logger,
	metrics ...*observability.Metrics,
) *Manager {
	var metricsRecorder *observability.Metrics

	if len(metrics) > 0 {
		metricsRecorder =
			metrics[0]
	}

	return &Manager{
		ctx:       ctx,
		meetingID: meetingID,
		assembly:  assembly,
		evidence:  evidenceDispatcher,
		logger:    logger,
		metrics:   metricsRecorder,
		tracks:    make(map[string]*trackState),
	}
}

func (m *Manager) HandleTrackSubscribed(
	track *webrtc.TrackRemote,
	publication *lksdk.RemoteTrackPublication,
	participant *lksdk.RemoteParticipant,
) {
	if publication.Source() != livekit.TrackSource_MICROPHONE {
		m.logger.Debug(
			"ignoring non-microphone track",
			"trackId", publication.SID(),
			"participant", participant.Identity(),
			"source", publication.Source().String(),
		)

		return
	}

	if !strings.EqualFold(
		track.Codec().MimeType,
		webrtc.MimeTypeOpus,
	) {
		m.logger.Warn(
			"ignoring unsupported microphone codec",
			"trackId", publication.SID(),
			"participant", participant.Identity(),
			"codec", track.Codec().MimeType,
		)

		return
	}

	trackID := publication.SID()

	trackCtx, cancel := context.WithCancel(m.ctx)

	state := &trackState{
		cancel: cancel,
	}

	reserved, err :=
		m.reserveTrack(
			trackID,
			state,
		)

	if err != nil {
		cancel()

		m.logger.Warn(
			"microphone track rejected because meeting resource limit was reached",

			"meetingId",
			m.meetingID,

			"trackId",
			trackID,

			"participant",
			participant.Identity(),

			"maxConcurrentTracks",
			maxConcurrentMicrophoneTracks,

			"error",
			err,
		)

		return
	}

	if !reserved {
		cancel()

		return
	}

	m.wg.Go(func() {
		m.runTrack(
			trackCtx,
			track,
			publication,
			participant,
			state,
		)
	})
}

func (m *Manager) HandleTrackUnsubscribed(
	_ *webrtc.TrackRemote,
	publication *lksdk.RemoteTrackPublication,
	participant *lksdk.RemoteParticipant,
) {
	m.logger.Info(
		"microphone track unsubscribed",
		"trackId", publication.SID(),
		"participant", participant.Identity(),
	)

	m.stopTrack(publication.SID())
}

func (m *Manager) Close() {
	m.mu.Lock()

	states := make(
		[]*trackState,
		0,
		len(m.tracks),
	)

	for trackID, state := range m.tracks {
		states = append(states, state)
		delete(m.tracks, trackID)
	}

	m.updateActiveMicrophoneTracksMetricLocked()

	m.mu.Unlock()

	for _, state := range states {
		state.cancel()
	}

	m.wg.Wait()
}

func (m *Manager) runTrack(
	ctx context.Context,
	track *webrtc.TrackRemote,
	publication *lksdk.RemoteTrackPublication,
	participant *lksdk.RemoteParticipant,
	state *trackState,
) {
	trackID := publication.SID()
	participantIdentity := participant.Identity()

	defer m.removeTrack(
		trackID,
		state,
	)

	// The track context controls RTP consumption.
	//
	// AssemblyAI gets its own lifecycle so an unsubscribe does not
	// immediately kill the transcription websocket before buffered
	// audio and the Terminate message are flushed.
	sessionCtx, sessionCancel := context.WithCancel(
		context.Background(),
	)
	defer sessionCancel()

	session, err := m.assembly.OpenSession(
		sessionCtx,
		func(turn assemblyai.Turn) {
			if turn.Transcript == "" {
				return
			}

			if turn.EndOfTurn {
				m.logger.Info(
					"transcript final",
					"participant", participantIdentity,
					"trackId", trackID,
					"turnOrder", turn.TurnOrder,
					"transcript", turn.Transcript,
				)

				evidenceTurn, err := evidence.NewTurn(
					m.meetingID,
					participantIdentity,
					trackID,
					turn.TurnOrder,
					turn.Transcript,
					time.Now().UTC(),
				)
				if err != nil {
					m.logger.Error(
						"failed to create evidence turn",
						"participant", participantIdentity,
						"trackId", trackID,
						"turnOrder", turn.TurnOrder,
						"error", err,
					)

					return
				}

				if err := m.evidence.Enqueue(
					sessionCtx,
					evidenceTurn,
				); err != nil {
					m.logger.Error(
						"failed to enqueue evidence turn",
						"eventId", evidenceTurn.EventID,
						"error", err,
					)
				}

				return
			}

			m.logger.Debug(
				"transcript partial",
				"participant", participantIdentity,
				"trackId", trackID,
				"turnOrder", turn.TurnOrder,
				"transcript", turn.Transcript,
			)
		},
	)

	if err != nil {
		m.logger.Error(
			"failed to open AssemblyAI session",
			"participant", participantIdentity,
			"trackId", trackID,
			"error", err,
		)

		return
	}

	chunker := newPCMChunker(
		sessionCtx,
		session,
	)

	defer func() {
		if err := chunker.Close(); err != nil {
			m.logger.Warn(
				"failed to close transcription pipeline cleanly",
				"participant", participantIdentity,
				"trackId", trackID,
				"error", err,
			)
		}
	}()

	decoder, err := opus.NewDecoderWithOutput(
		targetSampleRate,
		targetChannels,
	)
	if err != nil {
		m.logger.Error(
			"failed to create Opus decoder",
			"participant", participantIdentity,
			"trackId", trackID,
			"error", err,
		)

		return
	}

	builder := samplebuilder.New(
		maxLateAudioPackets,
		&codecs.OpusPacket{},
		track.Codec().ClockRate,
	)

	decodeBuffer := make(
		[]int16,
		maxDecodedSamples*targetChannels,
	)

	m.logger.Info(
		"transcription pipeline started",
		"participant", participantIdentity,
		"trackId", trackID,
		"codec", track.Codec().MimeType,
		"sampleRate", targetSampleRate,
		"channels", targetChannels,
	)

	for {
		if ctx.Err() != nil {
			break
		}

		if err := track.SetReadDeadline(
			time.Now().Add(trackReadTimeout),
		); err != nil {
			m.logger.Error(
				"failed to set RTP read deadline",
				"participant", participantIdentity,
				"trackId", trackID,
				"error", err,
			)

			break
		}

		packet, _, err := track.ReadRTP()
		if err != nil {
			if ctx.Err() != nil {
				break
			}

			var netErr net.Error

			if errors.As(err, &netErr) &&
				netErr.Timeout() {
				continue
			}

			m.logger.Warn(
				"RTP read stopped",
				"participant", participantIdentity,
				"trackId", trackID,
				"error", err,
			)

			break
		}

		builder.Push(packet)

		if err := drainSamples(
			builder,
			&decoder,
			decodeBuffer,
			chunker,
		); err != nil {
			m.logger.Error(
				"audio pipeline failed",
				"participant", participantIdentity,
				"trackId", trackID,
				"error", err,
			)

			return
		}
	}

	// Flush media that was already buffered before the
	// track stopped.
	builder.Flush()

	if err := drainSamples(
		builder,
		&decoder,
		decodeBuffer,
		chunker,
	); err != nil {
		m.logger.Warn(
			"failed to flush final audio",
			"participant", participantIdentity,
			"trackId", trackID,
			"error", err,
		)
	}
}

func drainSamples(
	builder *samplebuilder.SampleBuilder,
	decoder *opus.Decoder,
	decodeBuffer []int16,
	chunker *pcmChunker,
) error {
	for {
		sample := builder.Pop()
		if sample == nil {
			return nil
		}

		sampleCount, err := decoder.DecodeToInt16(
			sample.Data,
			decodeBuffer,
		)
		if err != nil {
			return err
		}

		if sampleCount == 0 {
			continue
		}

		totalSamples := sampleCount * targetChannels

		if totalSamples > len(decodeBuffer) {
			return errors.New(
				"decoded Opus sample count exceeds buffer",
			)
		}

		if err := chunker.Write(
			decodeBuffer[:totalSamples],
		); err != nil {
			return err
		}
	}
}

func (m *Manager) stopTrack(
	trackID string,
) {
	m.mu.Lock()

	state, exists :=
		m.tracks[trackID]

	if exists {
		delete(
			m.tracks,
			trackID,
		)

		m.updateActiveMicrophoneTracksMetricLocked()
	}

	m.mu.Unlock()

	if exists {
		state.cancel()
	}
}

func (m *Manager) removeTrack(
	trackID string,
	state *trackState,
) {
	m.mu.Lock()

	current, exists :=
		m.tracks[trackID]

	if exists &&
		current == state {

		delete(
			m.tracks,
			trackID,
		)

		m.updateActiveMicrophoneTracksMetricLocked()
	}

	m.mu.Unlock()

	state.cancel()
}

// updateActiveMicrophoneTracksMetricLocked synchronizes this
// meeting's contribution to the process-wide microphone gauge.
//
// The caller MUST hold m.mu.
//
// Keeping the metric update under the same mutex as the tracks
// mutation preserves ordering between concurrent subscribe,
// unsubscribe and worker-exit events.
func (
	m *Manager,
) updateActiveMicrophoneTracksMetricLocked() {
	if m.metrics == nil {
		return
	}

	m.metrics.SetMeetingActiveMicrophoneTracks(
		m.meetingID,
		len(
			m.tracks,
		),
	)
}
