package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	RedisURL string

	LiveKitRoom        string
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
	loadDotEnv()

	cfg := Config{
		RedisURL: os.Getenv("REDIS_URL"),

		LiveKitRoom:        os.Getenv("LIVEKIT_ROOM"),
		LiveKitBotIdentity: os.Getenv("LIVEKIT_BOT_IDENTITY"),
		LiveKitURL:         os.Getenv("LIVEKIT_URL"),
		LiveKitAPIKey:      os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret:   os.Getenv("LIVEKIT_API_SECRET"),

		AssemblyAIAPIKey:       os.Getenv("ASSEMBLYAI_API_KEY"),
		AssemblyAIStreamingURL: os.Getenv("ASSEMBLYAI_STREAMING_URL"),

		SemanticProvider: strings.ToLower(
			strings.TrimSpace(
				os.Getenv("SEMANTIC_PROVIDER"),
			),
		),

		GroqAPIKey:        os.Getenv("GROQ_API_KEY"),
		GroqBaseURL:       os.Getenv("GROQ_BASE_URL"),
		GroqModel:         os.Getenv("GROQ_MODEL"),
		GroqFallbackModel: os.Getenv("GROQ_FALLBACK_MODEL"),

		RealtimePort: os.Getenv("REALTIME_PORT"),
	}

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

	required := map[string]string{
		"REDIS_URL":            cfg.RedisURL,
		"LIVEKIT_ROOM":         cfg.LiveKitRoom,
		"LIVEKIT_BOT_IDENTITY": cfg.LiveKitBotIdentity,
		"LIVEKIT_URL":          cfg.LiveKitURL,
		"LIVEKIT_API_KEY":      cfg.LiveKitAPIKey,
		"LIVEKIT_API_SECRET":   cfg.LiveKitAPISecret,
		"ASSEMBLYAI_API_KEY":   cfg.AssemblyAIAPIKey,
	}

	for name, value := range required {
		if strings.TrimSpace(value) == "" {
			return Config{}, fmt.Errorf(
				"required environment variable %s is missing",
				name,
			)
		}
	}

	switch cfg.SemanticProvider {
	case "groq":
		if strings.TrimSpace(cfg.GroqAPIKey) == "" {
			return Config{}, fmt.Errorf(
				"GROQ_API_KEY is required when SEMANTIC_PROVIDER=groq",
			)
		}

	default:
		return Config{}, fmt.Errorf(
			"unsupported semantic provider %q",
			cfg.SemanticProvider,
		)
	}

	return cfg, nil
}

func loadDotEnv() {
	candidates := []string{
		".env",
		"../../.env",
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			_ = godotenv.Load(path)
			return
		}
	}
}
