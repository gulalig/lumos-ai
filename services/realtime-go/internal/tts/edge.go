package tts

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/hajimehoshi/go-mp3"
	"github.com/kolonist/edgetts"
)

const (
	defaultRetryDelay = 150 * time.Millisecond
)

type EdgeOptions struct {
	Language string
	Voice    string

	Rate   string
	Volume string

	Timeout time.Duration

	MaxRetries int

	UsageRecorder UsageRecorder
}

type edgeSynthesizer func(
	ctx context.Context,
	text string,
) ([]byte, error)

type EdgeProvider struct {
	language string
	voice    string

	rate   string
	volume string

	timeout time.Duration

	maxRetries int

	usageRecorder UsageRecorder

	synthesize edgeSynthesizer

	retryDelay func(
		attempt int,
	) time.Duration
}

func NewEdgeProvider(
	options EdgeOptions,
) (*EdgeProvider, error) {
	options.Language =
		strings.TrimSpace(
			options.Language,
		)

	options.Voice =
		strings.TrimSpace(
			options.Voice,
		)

	options.Rate =
		strings.TrimSpace(
			options.Rate,
		)

	options.Volume =
		strings.TrimSpace(
			options.Volume,
		)

	if options.Language == "" {
		return nil, fmt.Errorf(
			"Edge TTS language is required",
		)
	}

	if options.Voice == "" {
		return nil, fmt.Errorf(
			"Edge TTS voice is required",
		)
	}

	if options.Timeout <= 0 {
		return nil, fmt.Errorf(
			"Edge TTS timeout must be positive",
		)
	}

	if options.MaxRetries < 0 {
		return nil, fmt.Errorf(
			"Edge TTS max retries cannot be negative",
		)
	}

	if options.MaxRetries > 5 {
		return nil, fmt.Errorf(
			"Edge TTS max retries cannot exceed 5",
		)
	}

	if options.Rate == "" {
		options.Rate = "+0%"
	}

	if options.Volume == "" {
		options.Volume = "+0%"
	}

	if options.UsageRecorder == nil {
		options.UsageRecorder =
			NoopUsageRecorder{}
	}

	edge :=
		edgetts.New(
			edgetts.Args{
				Voice: options.Voice,

				Rate: options.Rate,

				Volume: options.Volume,
			},
		)

	provider :=
		&EdgeProvider{
			language: options.Language,

			voice: options.Voice,

			rate: options.Rate,

			volume: options.Volume,

			timeout: options.Timeout,

			maxRetries: options.MaxRetries,

			usageRecorder: options.UsageRecorder,

			retryDelay: exponentialRetryDelay,
		}

	provider.synthesize =
		func(
			ctx context.Context,
			text string,
		) ([]byte, error) {
			encoded,
				err :=
				edge.
					Speak(
						text,
					).
					GetSound(
						ctx,
						edgetts.OutputFormatMp3,
					)
			if err != nil {
				return nil,
					fmt.Errorf(
						"request Edge MP3 audio: %w",
						err,
					)
			}

			pcm,
				err :=
				decodeEdgeMP3ToMonoPCM16(
					encoded,
				)
			if err != nil {
				return nil,
					fmt.Errorf(
						"decode Edge MP3 audio: %w",
						err,
					)
			}

			return pcm, nil
		}

	return provider, nil
}

func (
	p *EdgeProvider,
) Synthesize(
	ctx context.Context,
	text string,
) (Audio, error) {
	if ctx == nil {
		return Audio{}, fmt.Errorf(
			"Edge TTS context is required",
		)
	}

	text =
		strings.TrimSpace(
			text,
		)

	if text == "" {
		return Audio{}, fmt.Errorf(
			"Edge TTS text is required",
		)
	}

	characters :=
		len(
			[]rune(
				text,
			),
		)

	var lastErr error

	maxAttempts :=
		p.maxRetries + 1

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			p.recordUsage(
				characters,
				0,
				attempt-1,
				false,
			)

			return Audio{}, err
		}

		attemptCtx,
			cancel :=
			context.WithTimeout(
				ctx,
				p.timeout,
			)

		pcm,
			err :=
			p.synthesize(
				attemptCtx,
				text,
			)

		cancel()

		if err == nil {
			if len(pcm) == 0 {
				err =
					errors.New(
						"Edge TTS returned empty PCM audio",
					)
			} else if len(pcm)%2 != 0 {
				err =
					fmt.Errorf(
						"Edge TTS returned invalid PCM16 byte count %d",
						len(pcm),
					)
			}
		}

		if err == nil {
			audio :=
				Audio{
					PCM: pcm,

					SampleRate: EdgePCMSampleRate,

					Channels: EdgePCMChannels,

					Provider: ProviderEdge,

					Language: p.language,

					Voice: p.voice,

					Characters: characters,

					Attempts: attempt,
				}

			if err :=
				audio.Validate(); err != nil {

				p.recordUsage(
					characters,
					len(pcm),
					attempt,
					false,
				)

				return Audio{},
					fmt.Errorf(
						"validate Edge TTS audio: %w",
						err,
					)
			}

			p.recordUsage(
				characters,
				len(pcm),
				attempt,
				true,
			)

			return audio, nil
		}

		lastErr = err

		if ctx.Err() != nil {
			p.recordUsage(
				characters,
				0,
				attempt,
				false,
			)

			return Audio{}, ctx.Err()
		}

		if attempt == maxAttempts {
			break
		}

		delay :=
			p.retryDelay(
				attempt,
			)

		timer :=
			time.NewTimer(
				delay,
			)

		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}

			p.recordUsage(
				characters,
				0,
				attempt,
				false,
			)

			return Audio{}, ctx.Err()

		case <-timer.C:
		}
	}

	p.recordUsage(
		characters,
		0,
		maxAttempts,
		false,
	)

	return Audio{},
		fmt.Errorf(
			"Edge TTS synthesis failed after %d attempt(s): %w",
			maxAttempts,
			lastErr,
		)
}

func decodeEdgeMP3ToMonoPCM16(
	encoded []byte,
) ([]byte, error) {
	if len(encoded) == 0 {
		return nil, fmt.Errorf(
			"Edge MP3 audio is empty",
		)
	}

	decoder,
		err :=
		mp3.NewDecoder(
			bytes.NewReader(
				encoded,
			),
		)
	if err != nil {
		return nil,
			fmt.Errorf(
				"create MP3 decoder: %w",
				err,
			)
	}

	sampleRate :=
		decoder.SampleRate()

	if sampleRate != EdgePCMSampleRate {
		return nil,
			fmt.Errorf(
				"unexpected Edge MP3 sample rate %d, expected %d",
				sampleRate,
				EdgePCMSampleRate,
			)
	}

	stereoPCM,
		err :=
		io.ReadAll(
			decoder,
		)
	if err != nil {
		return nil,
			fmt.Errorf(
				"read decoded MP3 PCM: %w",
				err,
			)
	}

	if len(stereoPCM) == 0 {
		return nil, fmt.Errorf(
			"decoded Edge MP3 PCM is empty",
		)
	}

	// go-mp3 emits signed 16-bit little-endian stereo PCM.
	//
	// One stereo frame:
	//
	// left  = 2 bytes
	// right = 2 bytes
	//
	// Therefore the byte count must be divisible by 4.
	if len(stereoPCM)%4 != 0 {
		return nil,
			fmt.Errorf(
				"decoded Edge MP3 stereo PCM byte count must be divisible by 4, got %d",
				len(stereoPCM),
			)
	}

	frameCount :=
		len(stereoPCM) / 4

	monoPCM :=
		make(
			[]byte,
			frameCount*2,
		)

	for frameIndex := 0; frameIndex < frameCount; frameIndex++ {

		stereoOffset :=
			frameIndex * 4

		left :=
			int16(
				binary.LittleEndian.Uint16(
					stereoPCM[stereoOffset : stereoOffset+2],
				),
			)

		right :=
			int16(
				binary.LittleEndian.Uint16(
					stereoPCM[stereoOffset+2 : stereoOffset+4],
				),
			)

		mono :=
			int16(
				(int32(left) + int32(right)) / 2)

		monoOffset :=
			frameIndex * 2

		binary.LittleEndian.PutUint16(
			monoPCM[monoOffset:monoOffset+2],
			uint16(
				mono,
			),
		)
	}

	return monoPCM, nil
}

func (
	p *EdgeProvider,
) recordUsage(
	characters int,
	audioBytes int,
	attempts int,
	success bool,
) {
	p.usageRecorder.
		RecordTTSUsage(
			Usage{
				Provider: ProviderEdge,

				Language: p.language,

				Voice: p.voice,

				Characters: characters,

				AudioBytes: audioBytes,

				Attempts: attempts,

				Success: success,
			},
		)
}

func exponentialRetryDelay(
	attempt int,
) time.Duration {
	if attempt <= 1 {
		return defaultRetryDelay
	}

	delay :=
		defaultRetryDelay

	for index := 1; index < attempt; index++ {
		delay *= 2

		if delay >=
			2*time.Second {

			return 2 * time.Second
		}
	}

	return delay
}
