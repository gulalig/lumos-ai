package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"

	"lumos/realtime-go/internal/assemblyai"
	"lumos/realtime-go/internal/config"
	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/llmgateway"
	"lumos/realtime-go/internal/meetingactor"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/transcription"
)

const dependencyCheckTimeout = 10 * time.Second

func main() {
	logger := slog.New(
		slog.NewJSONHandler(os.Stdout, nil),
	)

	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error(
			"failed to load config",
			"error", err,
		)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	// Redis
	redisClient, err := redisclient.New(
		cfg.RedisURL,
	)
	if err != nil {
		logger.Error(
			"failed to create Redis client",
			"error", err,
		)
		os.Exit(1)
	}
	defer redisClient.Close()

	if err := checkDependency(
		ctx,
		redisClient.Ping,
	); err != nil {
		logger.Error(
			"Redis check failed",
			"error", err,
		)
		os.Exit(1)
	}

	logger.Info(
		"Redis connection established",
	)

	// Durable evidence pipeline
	evidencePublisher :=
		redisstream.NewEvidencePublisher(
			redisClient,
		)

	evidenceDispatcher :=
		evidence.NewDispatcher(
			evidencePublisher,
			logger,
		)

	// LiveKit
	liveKitClient, err := livekitclient.New(
		cfg.LiveKitURL,
		cfg.LiveKitAPIKey,
		cfg.LiveKitAPISecret,
	)
	if err != nil {
		logger.Error(
			"failed to create LiveKit client",
			"error", err,
		)
		os.Exit(1)
	}

	if err := checkDependency(
		ctx,
		liveKitClient.Check,
	); err != nil {
		logger.Error(
			"LiveKit check failed",
			"error", err,
		)
		os.Exit(1)
	}

	logger.Info(
		"LiveKit connection established",
	)

	// AssemblyAI realtime transcription
	assemblyAIClient := assemblyai.New(
		cfg.AssemblyAIAPIKey,
		cfg.AssemblyAIStreamingURL,
	)

	if err := checkDependency(
		ctx,
		assemblyAIClient.Check,
	); err != nil {
		logger.Error(
			"AssemblyAI check failed",
			"error", err,
		)
		os.Exit(1)
	}

	logger.Info(
		"AssemblyAI authentication verified",
	)

	// Semantic extraction through AssemblyAI LLM Gateway
	semanticExtractor, err := llmgateway.New(
		cfg.AssemblyAIAPIKey,
		cfg.AssemblyAILLMBaseURL,
		cfg.AssemblyAILLMModel,
	)
	if err != nil {
		logger.Error(
			"failed to create semantic extractor",
			"error", err,
		)
		os.Exit(1)
	}

	// Durable semantic observations
	semanticPublisher :=
		redisstream.NewSemanticPublisher(
			redisClient,
		)

	// MeetingActor
	actor := meetingactor.New(
		cfg.LiveKitRoom,
		semanticExtractor,
		semanticPublisher,
		logger,
	)

	actorConsumer := meetingactor.NewConsumer(
		redisClient,
		actor,
		cfg.LiveKitRoom,
		"realtime-"+uuid.NewString(),
		logger,
	)

	actorErr := make(
		chan error,
		1,
	)

	go func() {
		actorErr <- actorConsumer.Run(ctx)
	}()

	// Realtime transcription orchestration
	transcriptionManager :=
		transcription.NewManager(
			ctx,
			cfg.LiveKitRoom,
			assemblyAIClient,
			evidenceDispatcher,
			logger,
		)

	// Join LiveKit only after all required dependencies
	// and processing components are initialized.
	room, err := liveKitClient.ConnectToRoom(
		cfg.LiveKitRoom,
		cfg.LiveKitBotIdentity,
		transcriptionManager,
	)
	if err != nil {
		logger.Error(
			"failed to join LiveKit room",
			"error", err,
		)

		os.Exit(1)
	}

	logger.Info(
		"LUMOS joined LiveKit room",
		"room", cfg.LiveKitRoom,
		"identity", cfg.LiveKitBotIdentity,
	)

	logger.Info(
		"LUMOS realtime service started",
		"service", "realtime-go",
	)

	select {
	case <-ctx.Done():

	case err := <-actorErr:
		if err != nil {
			logger.Error(
				"meeting actor consumer stopped unexpectedly",
				"error", err,
			)
		} else {
			logger.Warn(
				"meeting actor consumer stopped unexpectedly",
			)
		}

		// Ensure the rest of the realtime service
		// receives cancellation as well.
		stop()
	}

	logger.Info(
		"LUMOS realtime service shutting down",
		"service", "realtime-go",
	)

	// Shutdown order matters:
	//
	// 1. Stop audio producers and flush AssemblyAI sessions.
	// 2. Drain remaining EvidenceTurn events into Redis.
	// 3. Disconnect from LiveKit.
	transcriptionManager.Close()
	evidenceDispatcher.Close()
	room.Disconnect()

	logger.Info(
		"LUMOS realtime service stopped",
		"service", "realtime-go",
	)
}

func checkDependency(
	parent context.Context,
	check func(context.Context) error,
) error {
	ctx, cancel := context.WithTimeout(
		parent,
		dependencyCheckTimeout,
	)
	defer cancel()

	return check(ctx)
}
