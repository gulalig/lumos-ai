package config

import (
	"fmt"
	"os"

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
	AssemblyAILLMBaseURL string
  AssemblyAILLMModel   string

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
		AssemblyAILLMBaseURL:   os.Getenv("ASSEMBLYAI_LLM_BASE_URL"),
    AssemblyAILLMModel:     os.Getenv("ASSEMBLYAI_LLM_MODEL"),

		RealtimePort: os.Getenv("REALTIME_PORT"),
	}

	if cfg.RealtimePort == "" {
		cfg.RealtimePort = "8081"
	}

	if cfg.AssemblyAIStreamingURL == "" {
		cfg.AssemblyAIStreamingURL = "wss://streaming.assemblyai.com/v3/ws"
	}

	if cfg.AssemblyAILLMBaseURL == "" {
  	cfg.AssemblyAILLMBaseURL = "https://llm-gateway.assemblyai.com/v1"
  }

  if cfg.AssemblyAILLMModel == "" {
  	cfg.AssemblyAILLMModel = "openai/gpt-5-nano"
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
		if value == "" {
			return Config{}, fmt.Errorf("required environment variable %s is missing", name)
		}
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
