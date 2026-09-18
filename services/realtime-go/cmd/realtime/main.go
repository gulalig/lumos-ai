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
	"lumos/realtime-go/internal/groqsemantic"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/meetingactor"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/transcription"
)

const (
	dependencyCheckTimeout = 10 * time.Second
	shutdownWaitTimeout    = 5 * time.Second
)

func main() {
	logger := slog.New(
		slog.NewJSONHandler(
			os.Stdout,
			nil,
		),
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

	// Groq semantic extraction
	semanticExtractor, err := groqsemantic.New(
		cfg.GroqAPIKey,
		cfg.GroqBaseURL,
		cfg.GroqModel,
	)
	if err != nil {
		logger.Error(
			"failed to create semantic extractor",
			"provider", cfg.SemanticProvider,
			"error", err,
		)

		os.Exit(1)
	}

	logger.Info(
		"semantic extractor configured",
		"provider", cfg.SemanticProvider,
		"model", cfg.GroqModel,
	)

	// Durable semantic observations
	semanticPublisher :=
		redisstream.NewSemanticPublisher(
			redisClient,
		)

	// Meeting actor
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

	// Join LiveKit only after all dependencies
	// and processing components are ready.
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

		stop()
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
		logger.Info(
			"shutdown signal received",
		)

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

		stop()
	}

	logger.Info(
		"LUMOS realtime service shutting down",
		"service", "realtime-go",
	)

	// Stop producing new transcript/evidence events first.
	transcriptionManager.Close()

	// Flush buffered EvidenceTurn events to Redis.
	evidenceDispatcher.Close()

	// Leave the realtime room after transcription pipelines
	// have been flushed.
	room.Disconnect()

	// Make sure all remaining components observe cancellation.
	stop()

	waitForActorShutdown(
		actorErr,
		logger,
	)

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

func waitForActorShutdown(
	actorErr <-chan error,
	logger *slog.Logger,
) {
	timer := time.NewTimer(
		shutdownWaitTimeout,
	)
	defer timer.Stop()

	select {
	case err := <-actorErr:
		if err != nil {
			logger.Warn(
				"meeting actor stopped during shutdown",
				"error", err,
			)
		}

	case <-timer.C:
		logger.Warn(
			"timed out waiting for meeting actor shutdown",
		)
	}
}
