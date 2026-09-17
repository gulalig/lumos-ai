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
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/redisclient"
)

func main() {
	logger := slog.New(
		slog.NewJSONHandler(os.Stdout, nil),
	)

	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	checkCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	redisClient, err := redisclient.New(cfg.RedisURL)
	if err != nil {
		logger.Error("failed to create redis client", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()

	if err := redisClient.Ping(checkCtx); err != nil {
		logger.Error("redis check failed", "error", err)
		os.Exit(1)
	}

	logger.Info("Redis connection established")

	liveKitClient, err := livekitclient.New(
		cfg.LiveKitURL,
		cfg.LiveKitAPIKey,
		cfg.LiveKitAPISecret,
	)
	if err != nil {
		logger.Error("failed to create LiveKit client", "error", err)
		os.Exit(1)
	}

	if err := liveKitClient.Check(checkCtx); err != nil {
		logger.Error("LiveKit check failed", "error", err)
		os.Exit(1)
	}

	logger.Info("LiveKit connection established")

	room, err := liveKitClient.ConnectToRoom(
		cfg.LiveKitRoom,
		cfg.LiveKitBotIdentity,
	)
	if err != nil {
		logger.Error(
			"failed to join LiveKit room",
			"error", err,
		)
		os.Exit(1)
	}
	defer room.Disconnect()

	logger.Info(
		"LUMOS joined LiveKit room",
		"room", cfg.LiveKitRoom,
		"identity", cfg.LiveKitBotIdentity,
	)

	assemblyAIClient := assemblyai.New(
		cfg.AssemblyAIAPIKey,
		cfg.AssemblyAIStreamingURL,
	)

	if err := assemblyAIClient.Check(checkCtx); err != nil {
		logger.Error("AssemblyAI check failed", "error", err)
		os.Exit(1)
	}

	logger.Info("AssemblyAI authentication verified")

	logger.Info(
		"LUMOS realtime service started",
		"service", "realtime-go",
	)

	<-ctx.Done()

	logger.Info(
		"LUMOS realtime service shutting down",
		"service", "realtime-go",
	)
}
