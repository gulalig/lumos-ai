package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"

	"lumos/realtime-go/internal/assemblyai"
	"lumos/realtime-go/internal/config"
	"lumos/realtime-go/internal/groqsemantic"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/meetinglifecycle"
	"lumos/realtime-go/internal/meetingruntime"
	"lumos/realtime-go/internal/meetingsupervisor"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/semantics"
	"lumos/realtime-go/internal/tts"
)

const (
	dependencyCheckTimeout = 10 * time.Second

	metricsReadHeaderTimeout = 5 * time.Second
	metricsReadTimeout       = 10 * time.Second
	metricsWriteTimeout      = 10 * time.Second
	metricsIdleTimeout       = 30 * time.Second
	metricsShutdownTimeout   = 5 * time.Second

	supervisorShutdownWaitTimeout = 15 * time.Second
)

func main() {
	logger := slog.New(
		slog.NewJSONHandler(
			os.Stdout,
			nil,
		),
	)

	slog.SetDefault(
		logger,
	)

	cfg, err := config.Load()
	if err != nil {
		logger.Error(
			"failed to load config",
			"error", err,
		)

		os.Exit(1)
	}

	metrics := observability.NewMetrics()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	// -------------------------------------------------------------------------
	// Redis
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// LiveKit
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// AssemblyAI
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// Semantic extraction
	// -------------------------------------------------------------------------

	primarySemanticExtractor, err :=
		groqsemantic.New(
			cfg.GroqAPIKey,
			cfg.GroqBaseURL,
			cfg.GroqModel,
		)
	if err != nil {
		logger.Error(
			"failed to create primary semantic extractor",
			"provider", cfg.SemanticProvider,
			"model", cfg.GroqModel,
			"error", err,
		)

		os.Exit(1)
	}

	fallbackSemanticExtractor, err :=
		groqsemantic.New(
			cfg.GroqAPIKey,
			cfg.GroqBaseURL,
			cfg.GroqFallbackModel,
		)
	if err != nil {
		logger.Error(
			"failed to create fallback semantic extractor",
			"provider", cfg.SemanticProvider,
			"model", cfg.GroqFallbackModel,
			"error", err,
		)

		os.Exit(1)
	}

	semanticExtractor :=
		semantics.NewFallbackExtractor(
			primarySemanticExtractor,
			fallbackSemanticExtractor,
			logger,
		)

	logger.Info(
		"semantic extractors configured",
		"provider", cfg.SemanticProvider,
		"primaryModel", cfg.GroqModel,
		"fallbackModel", cfg.GroqFallbackModel,
	)

	// -------------------------------------------------------------------------
	// Text-to-speech
	// -------------------------------------------------------------------------

	var ttsProviderFactory tts.ProviderFactory

	switch cfg.TTSProvider {
	case tts.ProviderEdge:
		ttsProviderFactory =
			func() (tts.Provider, error) {
				return tts.NewEdgeProvider(
					tts.EdgeOptions{
						Language: cfg.TTSLanguage,

						Voice: cfg.TTSVoice,

						Rate: cfg.TTSRate,

						Volume: cfg.TTSVolume,

						Timeout: cfg.TTSTimeout,

						MaxRetries: cfg.TTSMaxRetries,
					},
				)
			}

	default:
		logger.Error(
			"unsupported TTS provider",
			"provider",
			cfg.TTSProvider,
		)

		os.Exit(1)
	}

	logger.Info(
		"TTS configured",
		"provider",
		cfg.TTSProvider,
		"language",
		cfg.TTSLanguage,
		"voice",
		cfg.TTSVoice,
		"rate",
		cfg.TTSRate,
		"volume",
		cfg.TTSVolume,
		"timeout",
		cfg.TTSTimeout,
		"maxRetries",
		cfg.TTSMaxRetries,
	)

	// -------------------------------------------------------------------------
	// Per-meeting runtime factory
	// -------------------------------------------------------------------------

	runtime, err := meetingruntime.New(
		redisClient,
		liveKitClient,
		assemblyAIClient,
		semanticExtractor,
		ttsProviderFactory,
		cfg.LiveKitBotIdentity,
		logger,
		metrics,
	)

	if err != nil {
		logger.Error(
			"failed to create meeting runtime",
			"error", err,
		)

		os.Exit(1)
	}

	// -------------------------------------------------------------------------
	// Durable lifecycle consumer
	// -------------------------------------------------------------------------

	lifecycleConsumer, err :=
		meetinglifecycle.NewConsumer(
			redisClient,
			logger,
		)
	if err != nil {
		logger.Error(
			"failed to create meeting lifecycle consumer",
			"error", err,
		)

		os.Exit(1)
	}

	// -------------------------------------------------------------------------
	// Meeting runtime ownership
	// -------------------------------------------------------------------------

	instanceID :=
		"realtime-" +
			uuid.NewString()

	leaseManager, err :=
		meetinglease.New(
			redisClient,
			meetinglease.DefaultTTL,
		)

	if err != nil {
		logger.Error(
			"failed to create meeting lease manager",
			"error",
			err,
		)

		os.Exit(1)
	}

	// -------------------------------------------------------------------------
	// Meeting supervisor
	// -------------------------------------------------------------------------

	supervisor, err :=
		meetingsupervisor.New(
			runtime,
			leaseManager,
			instanceID,
			logger,
			metrics,
		)

	if err != nil {
		logger.Error(
			"failed to create meeting supervisor",
			"error",
			err,
		)

		os.Exit(1)
	}

	// -------------------------------------------------------------------------
	// Observability HTTP server
	// -------------------------------------------------------------------------

	metricsMux :=
		http.NewServeMux()

	metricsMux.Handle(
		"/metrics",
		metrics.Handler(),
	)

	metricsServer :=
		&http.Server{
			Addr: ":" + cfg.RealtimePort,

			Handler: metricsMux,

			ReadHeaderTimeout: metricsReadHeaderTimeout,

			ReadTimeout: metricsReadTimeout,

			WriteTimeout: metricsWriteTimeout,

			IdleTimeout: metricsIdleTimeout,
		}

	serviceCtx, cancelService :=
		context.WithCancel(
			ctx,
		)

	defer cancelService()

	metricsServerErr :=
		make(
			chan error,
			1,
		)

	go func() {
		logger.Info(
			"LUMOS metrics server listening",

			"address",
			metricsServer.Addr,

			"path",
			"/metrics",
		)

		err :=
			metricsServer.
				ListenAndServe()

		if errors.Is(
			err,
			http.ErrServerClosed,
		) {
			err = nil
		}

		metricsServerErr <- err
	}()

	supervisorErr :=
		make(
			chan error,
			1,
		)

	go func() {
		supervisorErr <- supervisor.Run(
			serviceCtx,
			lifecycleConsumer,
		)
	}()

	logger.Info(
		"LUMOS realtime service started",

		"service",
		"realtime-go",

		"mode",
		"dynamic-meeting-lifecycle",

		"instanceId",
		instanceID,

		"metricsAddress",
		metricsServer.Addr,

		"metricsPath",
		"/metrics",
	)

	var (
		serviceErr error

		supervisorFinished bool
	)

	select {
	case <-ctx.Done():
		// Normal OS/service shutdown.

	case err :=
		<-supervisorErr:

		supervisorFinished = true

		if ctx.Err() == nil {
			if err != nil {
				serviceErr =
					fmt.Errorf(
						"meeting supervisor stopped unexpectedly: %w",
						err,
					)
			} else {
				serviceErr =
					errors.New(
						"meeting supervisor stopped unexpectedly without an error",
					)
			}
		}

	case err :=
		<-metricsServerErr:

		if ctx.Err() == nil {
			if err != nil {
				serviceErr =
					fmt.Errorf(
						"metrics HTTP server stopped unexpectedly: %w",
						err,
					)
			} else {
				serviceErr =
					errors.New(
						"metrics HTTP server stopped unexpectedly without an error",
					)
			}
		}
	}

	// Stop new runtime work regardless of which component caused
	// service shutdown.
	cancelService()

	// -------------------------------------------------------------------------
	// Graceful metrics HTTP shutdown
	// -------------------------------------------------------------------------

	metricsShutdownCtx,
		cancelMetricsShutdown :=
		context.WithTimeout(
			context.Background(),
			metricsShutdownTimeout,
		)

	if err :=
		metricsServer.Shutdown(
			metricsShutdownCtx,
		); err != nil {

		logger.Error(
			"metrics HTTP server shutdown failed",
			"error",
			err,
		)

		if serviceErr == nil {
			serviceErr =
				fmt.Errorf(
					"shutdown metrics HTTP server: %w",
					err,
				)
		}
	}

	cancelMetricsShutdown()

	// -------------------------------------------------------------------------
	// Wait for meeting supervisor shutdown
	// -------------------------------------------------------------------------

	if !supervisorFinished {
		select {
		case err :=
			<-supervisorErr:

			supervisorFinished = true

			if err != nil &&
				ctx.Err() == nil &&
				serviceErr == nil {

				serviceErr =
					fmt.Errorf(
						"meeting supervisor shutdown: %w",
						err,
					)
			}

		case <-time.After(
			supervisorShutdownWaitTimeout,
		):
			if serviceErr == nil {
				serviceErr =
					fmt.Errorf(
						"timed out waiting for meeting supervisor shutdown",
					)
			}
		}
	}

	if serviceErr != nil {
		logger.Error(
			"LUMOS realtime service stopped with error",

			"service",
			"realtime-go",

			"error",
			serviceErr,
		)

		os.Exit(1)
	}

	logger.Info(
		"LUMOS realtime service stopped",
		"service",
		"realtime-go",
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

	return check(
		ctx,
	)
}
