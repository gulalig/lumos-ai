package meetingruntime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	lksdk "github.com/livekit/server-sdk-go/v2"

	"lumos/realtime-go/internal/assemblyai"
	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/intervention"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/meetingactor"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/meetingstate"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/semantics"
	"lumos/realtime-go/internal/speechfloor"
	"lumos/realtime-go/internal/transcription"
	"lumos/realtime-go/internal/tts"
)

const (
	shutdownWaitTimeout = 5 * time.Second

	evidenceDrainTimeout = 30 * time.Second
)

type Runtime struct {
	redisClient *redisclient.Client

	liveKit *livekitclient.Client

	assemblyAI *assemblyai.Client

	extractor semantics.Extractor

	ttsProviderFactory tts.ProviderFactory

	botIdentity string

	logger  *slog.Logger
	metrics *observability.Metrics
}

func New(
	redisClient *redisclient.Client,
	liveKit *livekitclient.Client,
	assemblyAI *assemblyai.Client,
	extractor semantics.Extractor,
	ttsProviderFactory tts.ProviderFactory,
	botIdentity string,
	logger *slog.Logger,
	metrics ...*observability.Metrics,
) (*Runtime, error) {
	if redisClient == nil {
		return nil, fmt.Errorf(
			"meeting runtime redis client is required",
		)
	}

	if liveKit == nil {
		return nil, fmt.Errorf(
			"meeting runtime LiveKit client is required",
		)
	}

	if assemblyAI == nil {
		return nil, fmt.Errorf(
			"meeting runtime AssemblyAI client is required",
		)
	}

	if extractor == nil {
		return nil, fmt.Errorf(
			"meeting runtime semantic extractor is required",
		)
	}

	if ttsProviderFactory == nil {
		return nil, fmt.Errorf(
			"meeting runtime TTS provider factory is required",
		)
	}

	botIdentity =
		strings.TrimSpace(
			botIdentity,
		)

	if botIdentity == "" {
		return nil, fmt.Errorf(
			"meeting runtime bot identity is required",
		)
	}

	if logger == nil {
		logger = slog.Default()
	}

	var metricsRecorder *observability.Metrics

	if len(metrics) > 0 {
		metricsRecorder =
			metrics[0]
	}

	return &Runtime{
		redisClient: redisClient,

		liveKit: liveKit,

		assemblyAI: assemblyAI,

		extractor: extractor,

		ttsProviderFactory: ttsProviderFactory,

		botIdentity: botIdentity,

		logger: logger,

		metrics: metricsRecorder,
	}, nil
}

func (r *Runtime) Run(
	parent context.Context,
	lease meetinglease.Lease,
	roomName string,
) error {
	meetingID :=
		strings.TrimSpace(
			lease.MeetingID,
		)

	ownerID :=
		strings.TrimSpace(
			lease.OwnerID,
		)

	token :=
		strings.TrimSpace(
			lease.Token,
		)

	roomName =
		strings.TrimSpace(
			roomName,
		)

	if meetingID == "" {
		return fmt.Errorf(
			"meeting ID is required",
		)
	}

	if ownerID == "" {
		return fmt.Errorf(
			"meeting runtime lease owner ID is required",
		)
	}

	if token == "" {
		return fmt.Errorf(
			"meeting runtime lease token is required",
		)
	}

	if lease.Fence <= 0 {
		return fmt.Errorf(
			"meeting runtime lease fence must be positive",
		)
	}

	if roomName == "" {
		return fmt.Errorf(
			"LiveKit room name is required",
		)
	}

	logger := r.logger.With(
		"meetingId",
		meetingID,

		"roomName",
		roomName,

		"instanceId",
		ownerID,

		"fence",
		lease.Fence,
	)

	logger.Info(
		"meeting runtime initializing",
	)

	// Media lifecycle follows the external meeting
	// lifecycle.
	//
	// When the meeting ends this context is cancelled
	// immediately so RTP production stops.
	mediaCtx, stopMedia :=
		context.WithCancel(
			parent,
		)

	defer stopMedia()

	// Semantic processing intentionally has an
	// independent lifecycle.
	//
	// A meeting ending must NOT cancel an in-flight
	// Groq extraction. It stays alive until durable
	// evidence has been fully processed.
	processingCtx, stopProcessing :=
		context.WithCancel(
			context.Background(),
		)

	defer stopProcessing()

	// -------------------------------------------------------------------------
	// Durable evidence pipeline
	// -------------------------------------------------------------------------

	evidencePublisher :=
		redisstream.NewEvidencePublisher(
			r.redisClient,
			lease,
		)

	evidenceDispatcher :=
		evidence.NewDispatcher(
			evidencePublisher,
			logger,
			r.metrics,
		)

	// -------------------------------------------------------------------------
	// MeetingState projector
	// -------------------------------------------------------------------------

	stateProjector, err :=
		meetingstate.NewProjector(
			r.redisClient,
			meetingID,
			logger,
		)

	if err != nil {
		evidenceDispatcher.Close()

		return fmt.Errorf(
			"create meeting state projector: %w",
			err,
		)
	}

	if err :=
		stateProjector.Replay(
			processingCtx,
		); err != nil {

		evidenceDispatcher.Close()

		return fmt.Errorf(
			"replay meeting state: %w",
			err,
		)
	}

	// -------------------------------------------------------------------------
	// MeetingActor
	// -------------------------------------------------------------------------

	actor :=
		meetingactor.New(
			meetingID,
			r.extractor,
			logger,
			r.metrics,
		)

	actorConsumer :=
		meetingactor.NewConsumer(
			r.redisClient,
			actor,
			lease,
			"realtime-"+uuid.NewString(),
			logger,
		)

	// -------------------------------------------------------------------------
	// Background semantic processing
	// -------------------------------------------------------------------------

	componentErr :=
		make(
			chan error,
			3,
		)

	var backgroundWG sync.WaitGroup

	backgroundWG.Go(func() {
		err :=
			stateProjector.Run(
				processingCtx,
			)

		if processingCtx.Err() != nil {
			return
		}

		if err != nil {
			select {
			case componentErr <- fmt.Errorf(
				"meeting state projector: %w",
				err,
			):

			case <-processingCtx.Done():
			}

			return
		}

		select {
		case componentErr <- fmt.Errorf(
			"meeting state projector stopped unexpectedly",
		):

		case <-processingCtx.Done():
		}
	})

	backgroundWG.Go(func() {
		err :=
			actorConsumer.Run(
				processingCtx,
			)

		if processingCtx.Err() != nil {
			return
		}

		if err != nil {
			select {
			case componentErr <- fmt.Errorf(
				"meeting actor consumer: %w",
				err,
			):

			case <-processingCtx.Done():
			}

			return
		}

		select {
		case componentErr <- fmt.Errorf(
			"meeting actor consumer stopped unexpectedly",
		):

		case <-processingCtx.Done():
		}
	})

	// -------------------------------------------------------------------------
	// Realtime transcription
	// -------------------------------------------------------------------------

	transcriptionManager :=
		transcription.NewManager(
			mediaCtx,
			meetingID,
			r.assemblyAI,
			evidenceDispatcher,
			logger,
			r.metrics,
		)
	floor := speechfloor.New(speechfloor.QuietWindow)
	transcriptionManager.ConfigureFloor(floor)

	// -------------------------------------------------------------------------
	// LiveKit
	// -------------------------------------------------------------------------

	room, err :=
		r.liveKit.ConnectToRoom(
			roomName,
			r.botIdentity,
			transcriptionManager,
		)

	if err != nil {
		stopMedia()

		transcriptionManager.Close()
		evidenceDispatcher.Close()

		stopProcessing()

		waitForBackground(
			&backgroundWG,
			logger,
		)

		return fmt.Errorf(
			"join LiveKit room: %w",
			err,
		)
	}

	configureFloorReply(room, transcriptionManager)
	// -------------------------------------------------------------------------
	// TTS intervention output
	// -------------------------------------------------------------------------

	ttsProvider, err :=
		r.ttsProviderFactory()
	if err != nil {
		stopMedia()

		transcriptionManager.Close()

		room.Disconnect()

		evidenceDispatcher.Close()

		stopProcessing()

		waitForBackground(
			&backgroundWG,
			logger,
		)

		return fmt.Errorf(
			"create TTS provider: %w",
			err,
		)
	}

	audioPublisher, err :=
		livekitclient.NewPCMAudioPublisher(
			room,
			tts.EdgePCMSampleRate,
			tts.EdgePCMChannels,
		)
	if err != nil {
		stopMedia()

		transcriptionManager.Close()

		room.Disconnect()

		evidenceDispatcher.Close()

		stopProcessing()

		waitForBackground(
			&backgroundWG,
			logger,
		)

		return fmt.Errorf(
			"create LiveKit intervention audio publisher: %w",
			err,
		)
	}

	interventionSpeaker, err :=
		intervention.NewTTSSpeaker(
			ttsProvider,
			audioPublisher,
			logger,
		)
	if err != nil {
		stopMedia()

		transcriptionManager.Close()

		room.Disconnect()

		evidenceDispatcher.Close()

		stopProcessing()

		waitForBackground(
			&backgroundWG,
			logger,
		)

		return fmt.Errorf(
			"create intervention TTS speaker: %w",
			err,
		)
	}

	interventionConsumer :=
		intervention.NewConsumer(
			r.redisClient,
			lease,
			"realtime-intervention-"+uuid.NewString(),
			interventionSpeaker,
			logger,
		)
	interventionSpeaker.Coordinate(floor, func(ctx context.Context, event intervention.Event) error {
		if err := r.redisClient.FencedCheck(ctx, meetinglease.LeaseKey(meetingID),
			meetinglease.FenceKey(meetingID), lease.Token, lease.Fence); err != nil {
			return err
		}
		return intervention.CheckCurrent(ctx, r.redisClient, event)
	})

	backgroundWG.Go(func() {
		err :=
			interventionConsumer.Run(
				mediaCtx,
			)

		if mediaCtx.Err() != nil {
			return
		}

		if err != nil {
			select {
			case componentErr <- fmt.Errorf(
				"intervention consumer: %w",
				err,
			):

			case <-processingCtx.Done():
			}

			return
		}

		select {
		case componentErr <- fmt.Errorf(
			"intervention consumer stopped unexpectedly",
		):

		case <-processingCtx.Done():
		}
	})

	logger.Info(
		"meeting runtime started",
		"identity",
		r.botIdentity,
		"ttsProvider",
		tts.ProviderEdge,
		"ttsSampleRate",
		tts.EdgePCMSampleRate,
		"ttsChannels",
		tts.EdgePCMChannels,
	)

	var runtimeErr error

	gracefulShutdown := false

	select {
	case <-parent.Done():
		gracefulShutdown = true

	case err :=
		<-evidenceDispatcher.Errors():

		runtimeErr =
			fmt.Errorf(
				"evidence dispatcher: %w",
				err,
			)

		logger.Error(
			"meeting runtime evidence durability failure",

			"error",
			runtimeErr,
		)

	case err := <-componentErr:
		runtimeErr = err

		logger.Error(
			"meeting runtime component stopped unexpectedly",
			"error",
			err,
		)
	}

	shutdownCause :=
		context.Cause(
			parent,
		)

	ownershipCause :=
		shutdownCause

	ownershipLost :=
		errors.Is(
			shutdownCause,
			meetinglease.ErrLeaseLost,
		)

	// Ownership can also be discovered by an actual fenced
	// Redis mutation before the lease keeper's next renewal
	// tick observes the loss.
	//
	// In that case the MeetingActor returns ErrLeaseLost
	// through componentErr.
	if !ownershipLost &&
		errors.Is(
			runtimeErr,
			meetinglease.ErrLeaseLost,
		) {

		ownershipLost = true

		ownershipCause =
			runtimeErr
	}

	if ownershipLost {
		gracefulShutdown = false

		logger.Error(
			"meeting runtime lost distributed ownership",
			"cause",
			ownershipCause,
		)
	}

	logger.Info(
		"meeting runtime shutting down",
	)

	if ownershipLost {
		logger.Warn(
			"meeting runtime performing ownership-loss shutdown",
		)

		// ---------------------------------------------------------
		// HARD OWNERSHIP STOP
		//
		// This process can no longer prove that it owns the
		// meeting. It must stop creating new semantic work.
		// ---------------------------------------------------------

		// Stop RTP production immediately.
		stopMedia()

		// Disconnect from LiveKit as early as possible.
		room.Disconnect()

		// Close the dispatcher BEFORE closing transcription.
		//
		// Existing evidence already accepted by the dispatcher
		// may finish publishing, but any final transcript emitted
		// while transcription is closing can no longer enqueue
		// fresh evidence.
		evidenceDispatcher.Close()

		// Stop active transcription pipelines.
		//
		// They may attempt their normal transport cleanup, but
		// the evidence dispatcher above no longer accepts turns.
		transcriptionManager.Close()

		// Do not drain Actor work under stale ownership.
		stopProcessing()

		waitForBackground(
			&backgroundWG,
			logger,
		)

		logger.Info(
			"meeting runtime stopped after ownership loss",
		)

		if runtimeErr != nil {
			return runtimeErr
		}

		return fmt.Errorf(
			"meeting runtime ownership lost: %w",
			ownershipCause,
		)
	}

	// -------------------------------------------------------------------------
	// Phase 1: stop producers
	// -------------------------------------------------------------------------

	stopMedia()

	// Flush remaining RTP / PCM / AssemblyAI data.
	//
	// AssemblyAI sessions use their own shutdown
	// context internally, so final buffered transcript
	// data can still be emitted here.
	transcriptionManager.Close()

	// No more media should arrive after this point.
	room.Disconnect()

	// Flush every queued EvidenceTurn into Redis.
	//
	// Dispatcher.Close is synchronous and only returns
	// after its internal queue has been consumed.
	evidenceDispatcher.Close()

	// -------------------------------------------------------------------------
	// Phase 2: drain durable evidence
	// -------------------------------------------------------------------------

	if gracefulShutdown {
		drainCtx, cancelDrain :=
			context.WithTimeout(
				context.Background(),
				evidenceDrainTimeout,
			)

		if err :=
			actorConsumer.Drain(
				drainCtx,
			); err != nil {

			logger.Error(
				"meeting evidence drain did not complete",
				"error",
				err,
			)
		}

		cancelDrain()
	}

	// -------------------------------------------------------------------------
	// Phase 3: stop semantic workers
	// -------------------------------------------------------------------------

	stopProcessing()

	waitForBackground(
		&backgroundWG,
		logger,
	)

	logger.Info(
		"meeting runtime stopped",
	)

	return runtimeErr
}

func waitForBackground(
	wg *sync.WaitGroup,
	logger *slog.Logger,
) {
	done :=
		make(
			chan struct{},
		)

	go func() {
		wg.Wait()
		close(done)
	}()

	timer :=
		time.NewTimer(
			shutdownWaitTimeout,
		)

	defer timer.Stop()

	select {
	case <-done:

	case <-timer.C:
		logger.Warn(
			"timed out waiting for meeting runtime background components",
		)
	}
}

func configureFloorReply(room *lksdk.Room, manager *transcription.Manager) {
	manager.ConfigureFloorReply(func(identity, requestID string, granted bool) error {
		kind := "busy"
		if granted {
			kind = "granted"
		}
		payload, err := json.Marshal(map[string]string{"type": kind, "requestId": requestID})
		if err != nil {
			return err
		}
		return room.LocalParticipant.PublishDataPacket(
			&lksdk.UserDataPacket{Payload: payload, Topic: transcription.FloorTopic},
			lksdk.WithDataPublishReliable(true), lksdk.WithDataPublishDestination([]string{identity}))
	})
}
