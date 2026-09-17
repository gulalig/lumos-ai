package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"lumos/realtime-go/internal/assemblyai"
	"lumos/realtime-go/internal/config"
	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/meetingactor"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
	"lumos/realtime-go/internal/transcription"

	"github.com/google/uuid"
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
	redisClient, err := redisclient.New(cfg.RedisURL)
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

	logger.Info("Redis connection established")

	actor := meetingactor.New(
		cfg.LiveKitRoom,
		logger,
	)

	actorConsumer := meetingactor.NewConsumer(
		redisClient,
		actor,
		cfg.LiveKitRoom,
		"realtime-"+uuid.NewString(),
		logger,
	)

	actorErr := make(chan error, 1)

	go func() {
		actorErr <- actorConsumer.Run(ctx)
	}()

	evidencePublisher := redisstream.NewEvidencePublisher(redisClient)

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

	logger.Info("LiveKit connection established")

	// AssemblyAI
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

	logger.Info("AssemblyAI authentication verified")

	// Transcription orchestration
	transcriptionManager := transcription.NewManager(
		ctx,
		cfg.LiveKitRoom,
		assemblyAIClient,
		evidenceDispatcher,
		logger,
	)

	// Join the LiveKit room only after all required
	// dependencies are known to be available.
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

			stop()
		}
	}

	logger.Info(
		"LUMOS realtime service shutting down",
		"service", "realtime-go",
	)

	transcriptionManager.Close()
	evidenceDispatcher.Close()
	room.Disconnect()
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
