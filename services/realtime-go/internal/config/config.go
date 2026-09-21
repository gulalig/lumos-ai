package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	RedisURL string

	LiveKitBotIdentity string
	LiveKitURL         string
	LiveKitAPIKey      string
	LiveKitAPISecret   string

	AssemblyAIAPIKey       string
	AssemblyAIStreamingURL string

	SemanticProvider string

	GroqAPIKey        string
	GroqBaseURL       string
	GroqModel         string
	GroqFallbackModel string

	RealtimePort string
}

func Load() (Config, error) {
	if err := loadDotEnv(); err != nil {
		return Config{}, err
	}

	cfg := Config{
		RedisURL: strings.TrimSpace(
			os.Getenv("REDIS_URL"),
		),

		LiveKitBotIdentity: strings.TrimSpace(
			os.Getenv("LIVEKIT_BOT_IDENTITY"),
		),

		LiveKitURL: strings.TrimSpace(
			os.Getenv("LIVEKIT_URL"),
		),

		LiveKitAPIKey: strings.TrimSpace(
			os.Getenv("LIVEKIT_API_KEY"),
		),

		LiveKitAPISecret: strings.TrimSpace(
			os.Getenv("LIVEKIT_API_SECRET"),
		),

		AssemblyAIAPIKey: strings.TrimSpace(
			os.Getenv("ASSEMBLYAI_API_KEY"),
		),

		AssemblyAIStreamingURL: strings.TrimSpace(
			os.Getenv("ASSEMBLYAI_STREAMING_URL"),
		),

		SemanticProvider: strings.ToLower(
			strings.TrimSpace(
				os.Getenv("SEMANTIC_PROVIDER"),
			),
		),

		GroqAPIKey: strings.TrimSpace(
			os.Getenv("GROQ_API_KEY"),
		),

		GroqBaseURL: strings.TrimSpace(
			os.Getenv("GROQ_BASE_URL"),
		),

		GroqModel: strings.TrimSpace(
			os.Getenv("GROQ_MODEL"),
		),

		GroqFallbackModel: strings.TrimSpace(
			os.Getenv("GROQ_FALLBACK_MODEL"),
		),

		RealtimePort: strings.TrimSpace(
			os.Getenv("REALTIME_PORT"),
		),
	}

	applyDefaults(&cfg)

	if err := validate(cfg); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func applyDefaults(
	cfg *Config,
) {
	if cfg.RealtimePort == "" {
		cfg.RealtimePort = "8081"
	}

	if cfg.AssemblyAIStreamingURL == "" {
		cfg.AssemblyAIStreamingURL =
			"wss://streaming.assemblyai.com/v3/ws"
	}

	if cfg.SemanticProvider == "" {
		cfg.SemanticProvider = "groq"
	}

	if cfg.GroqBaseURL == "" {
		cfg.GroqBaseURL =
			"https://api.groq.com/openai/v1"
	}

	if cfg.GroqModel == "" {
		cfg.GroqModel =
			"openai/gpt-oss-20b"
	}

	if cfg.GroqFallbackModel == "" {
		cfg.GroqFallbackModel =
			"openai/gpt-oss-120b"
	}
}

func validate(
	cfg Config,
) error {
	required := map[string]string{
		"REDIS_URL": cfg.RedisURL,

		"LIVEKIT_BOT_IDENTITY": cfg.LiveKitBotIdentity,

		"LIVEKIT_URL": cfg.LiveKitURL,

		"LIVEKIT_API_KEY": cfg.LiveKitAPIKey,

		"LIVEKIT_API_SECRET": cfg.LiveKitAPISecret,

		"ASSEMBLYAI_API_KEY": cfg.AssemblyAIAPIKey,
	}

	for name, value := range required {
		if value == "" {
			return fmt.Errorf(
				"required environment variable %s is missing",
				name,
			)
		}
	}

	switch cfg.SemanticProvider {
	case "groq":
		if cfg.GroqAPIKey == "" {
			return fmt.Errorf(
				"GROQ_API_KEY is required when SEMANTIC_PROVIDER=groq",
			)
		}

		if cfg.GroqBaseURL == "" {
			return fmt.Errorf(
				"GROQ_BASE_URL is required when SEMANTIC_PROVIDER=groq",
			)
		}

		if cfg.GroqModel == "" {
			return fmt.Errorf(
				"GROQ_MODEL is required when SEMANTIC_PROVIDER=groq",
			)
		}

		if cfg.GroqFallbackModel == "" {
			return fmt.Errorf(
				"GROQ_FALLBACK_MODEL is required when SEMANTIC_PROVIDER=groq",
			)
		}

	default:
		return fmt.Errorf(
			"unsupported semantic provider %q",
			cfg.SemanticProvider,
		)
	}

	return nil
}

func loadDotEnv() error {
	candidates := []string{
		".env",
		"../../.env",
	}

	for _, path := range candidates {
		_, err := os.Stat(path)

		if err == nil {
			if err := godotenv.Load(
				path,
			); err != nil {
				return fmt.Errorf(
					"load environment file %s: %w",
					path,
					err,
				)
			}

			return nil
		}

		if !os.IsNotExist(err) {
			return fmt.Errorf(
				"inspect environment file %s: %w",
				path,
				err,
			)
		}
	}

	return nil
}
