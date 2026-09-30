package config

import "testing"

func productionFixture() Config {
	cfg := Config{
		NodeEnv: "production", MetricsBearerToken: "fixture",
		RedisURL:           "rediss://fixture:fixture@redis.example.com:6379",
		LiveKitBotIdentity: "lumos", LiveKitURL: "wss://project.livekit.cloud",
		LiveKitAPIKey: "fixture", LiveKitAPISecret: "fixture",
		AssemblyAIAPIKey: "fixture", GroqAPIKey: "fixture",
		TTSTimeout: 8000000000, TTSMaxRetries: 2,
	}
	applyDefaults(&cfg)
	return cfg
}

func TestMetricsPrivateOnlyIsExplicitProductionPolicy(t *testing.T) {
	for _, test := range []struct {
		name, environment, token string
		private, allowed         bool
	}{
		{"production public without token", "production", "", false, false},
		{"production explicitly private without token", "production", "", true, true},
		{"production bearer protected", "production", "fixture", false, true},
		{"production private and bearer protected", "production", "fixture", true, true},
		{"development unconfigured", "development", "", false, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg := productionFixture()
			cfg.NodeEnv, cfg.MetricsBearerToken, cfg.MetricsPrivateOnly = test.environment, test.token, test.private
			if err := validate(cfg); (err == nil) != test.allowed {
				t.Fatalf("metrics policy allowed=%v, error=%v", test.allowed, err)
			}
		})
	}
}

func TestProductionTransportAndMetricsValidation(t *testing.T) {
	cfg := productionFixture()
	if err := validate(cfg); err != nil {
		t.Fatal(err)
	}
	cfg.MetricsBearerToken = ""
	if err := validate(cfg); err == nil {
		t.Fatal("public unauthenticated metrics accepted")
	}
	cfg.MetricsPrivateOnly = true
	if err := validate(cfg); err != nil {
		t.Fatal(err)
	}
	cfg.RedisURL = "redis://redis.example.com"
	if err := validate(cfg); err == nil {
		t.Fatal("plaintext production Redis accepted")
	}
	cfg.NodeEnv = "development"
	if err := validate(cfg); err != nil {
		t.Fatal(err)
	}
	cfg.NodeEnv = "prod"
	if err := validate(cfg); err == nil {
		t.Fatal("misspelled NODE_ENV must not bypass production safeguards")
	}
}
