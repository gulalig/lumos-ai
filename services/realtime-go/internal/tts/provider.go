package tts

import (
	"context"
	"fmt"
	"strings"
)

const (
	ProviderEdge = "edge"

	EdgePCMSampleRate = 24000
	EdgePCMChannels   = 1
)

type Audio struct {
	PCM []byte

	SampleRate int
	Channels   int

	Provider string
	Language string
	Voice    string

	Characters int
	Attempts   int
}

func (a Audio) Validate() error {
	if len(a.PCM) == 0 {
		return fmt.Errorf(
			"TTS audio PCM is empty",
		)
	}

	// PCM16 contains exactly two bytes per sample.
	if len(a.PCM)%2 != 0 {
		return fmt.Errorf(
			"TTS PCM byte count must be even, got %d",
			len(a.PCM),
		)
	}

	if a.SampleRate <= 0 {
		return fmt.Errorf(
			"TTS audio sample rate must be positive",
		)
	}

	if a.Channels <= 0 ||
		a.Channels > 2 {

		return fmt.Errorf(
			"TTS audio channels must be 1 or 2",
		)
	}

	if strings.TrimSpace(
		a.Provider,
	) == "" {
		return fmt.Errorf(
			"TTS audio provider is required",
		)
	}

	if strings.TrimSpace(
		a.Voice,
	) == "" {
		return fmt.Errorf(
			"TTS audio voice is required",
		)
	}

	if a.Characters <= 0 {
		return fmt.Errorf(
			"TTS character usage must be positive",
		)
	}

	if a.Attempts <= 0 {
		return fmt.Errorf(
			"TTS attempt count must be positive",
		)
	}

	return nil
}

type Provider interface {
	Synthesize(
		ctx context.Context,
		text string,
	) (Audio, error)
}

type ProviderFactory func() (Provider, error)

type Usage struct {
	Provider string
	Language string
	Voice    string

	Characters int
	AudioBytes int
	Attempts   int

	Success bool
}

type UsageRecorder interface {
	RecordTTSUsage(
		usage Usage,
	)
}

type NoopUsageRecorder struct{}

func (
	NoopUsageRecorder,
) RecordTTSUsage(
	Usage,
) {
}
