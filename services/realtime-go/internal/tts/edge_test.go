package tts

import (
	"context"
	"errors"
	"testing"
	"time"
)

type recordingUsage struct {
	values []Usage
}

func (
	r *recordingUsage,
) RecordTTSUsage(
	usage Usage,
) {
	r.values =
		append(
			r.values,
			usage,
		)
}

func TestEdgeProviderSynthesizesRawPCM(
	t *testing.T,
) {
	t.Parallel()

	recorder :=
		&recordingUsage{}

	provider :=
		&EdgeProvider{
			language: "en-US",

			voice: "en-US-AriaNeural",

			timeout: time.Second,

			maxRetries: 0,

			usageRecorder: recorder,

			retryDelay: func(
				int,
			) time.Duration {
				return 0
			},

			synthesize: func(
				context.Context,
				string,
			) ([]byte, error) {
				return []byte{
					0x01,
					0x00,
					0x02,
					0x00,
				}, nil
			},
		}

	audio, err :=
		provider.Synthesize(
			context.Background(),
			"Hello",
		)
	if err != nil {
		t.Fatalf(
			"Synthesize returned error: %v",
			err,
		)
	}

	if audio.SampleRate !=
		EdgePCMSampleRate {

		t.Fatalf(
			"unexpected sample rate: %d",
			audio.SampleRate,
		)
	}

	if audio.Channels != 1 {
		t.Fatalf(
			"unexpected channels: %d",
			audio.Channels,
		)
	}

	if audio.Characters != 5 {
		t.Fatalf(
			"unexpected character count: %d",
			audio.Characters,
		)
	}

	if audio.Attempts != 1 {
		t.Fatalf(
			"unexpected attempt count: %d",
			audio.Attempts,
		)
	}

	if len(audio.PCM) != 4 {
		t.Fatalf(
			"unexpected PCM size: %d",
			len(audio.PCM),
		)
	}

	if len(recorder.values) != 1 {
		t.Fatalf(
			"expected one usage record, got %d",
			len(recorder.values),
		)
	}

	usage :=
		recorder.values[0]

	if !usage.Success {
		t.Fatal(
			"expected successful usage record",
		)
	}

	if usage.Characters != 5 {
		t.Fatalf(
			"unexpected usage characters: %d",
			usage.Characters,
		)
	}

	if usage.AudioBytes != 4 {
		t.Fatalf(
			"unexpected usage audio bytes: %d",
			usage.AudioBytes,
		)
	}
}

func TestEdgeProviderRetriesTransientFailure(
	t *testing.T,
) {
	t.Parallel()

	attempts :=
		0

	recorder :=
		&recordingUsage{}

	provider :=
		&EdgeProvider{
			language: "en-US",

			voice: "en-US-AriaNeural",

			timeout: time.Second,

			maxRetries: 2,

			usageRecorder: recorder,

			retryDelay: func(
				int,
			) time.Duration {
				return time.Millisecond
			},

			synthesize: func(
				context.Context,
				string,
			) ([]byte, error) {
				attempts++

				if attempts < 3 {
					return nil,
						errors.New(
							"temporary provider failure",
						)
				}

				return []byte{
					0x01,
					0x00,
				}, nil
			},
		}

	audio, err :=
		provider.Synthesize(
			context.Background(),
			"Retry me",
		)
	if err != nil {
		t.Fatalf(
			"Synthesize returned error: %v",
			err,
		)
	}

	if attempts != 3 {
		t.Fatalf(
			"expected 3 attempts, got %d",
			attempts,
		)
	}

	if audio.Attempts != 3 {
		t.Fatalf(
			"unexpected audio attempt count: %d",
			audio.Attempts,
		)
	}

	if len(recorder.values) != 1 {
		t.Fatalf(
			"expected one usage record, got %d",
			len(recorder.values),
		)
	}

	if !recorder.values[0].Success {
		t.Fatal(
			"expected successful usage record",
		)
	}

	if recorder.values[0].Attempts != 3 {
		t.Fatalf(
			"unexpected usage attempt count: %d",
			recorder.values[0].Attempts,
		)
	}
}

func TestEdgeProviderFailsAfterRetryBudget(
	t *testing.T,
) {
	t.Parallel()

	attempts :=
		0

	recorder :=
		&recordingUsage{}

	provider :=
		&EdgeProvider{
			language: "en-US",

			voice: "en-US-AriaNeural",

			timeout: time.Second,

			maxRetries: 1,

			usageRecorder: recorder,

			retryDelay: func(
				int,
			) time.Duration {
				return time.Millisecond
			},

			synthesize: func(
				context.Context,
				string,
			) ([]byte, error) {
				attempts++

				return nil,
					errors.New(
						"provider unavailable",
					)
			},
		}

	_, err :=
		provider.Synthesize(
			context.Background(),
			"Fail",
		)

	if err == nil {
		t.Fatal(
			"expected synthesis failure",
		)
	}

	if attempts != 2 {
		t.Fatalf(
			"expected 2 attempts, got %d",
			attempts,
		)
	}

	if len(recorder.values) != 1 {
		t.Fatalf(
			"expected one usage record, got %d",
			len(recorder.values),
		)
	}

	usage :=
		recorder.values[0]

	if usage.Success {
		t.Fatal(
			"expected failed usage record",
		)
	}

	if usage.Attempts != 2 {
		t.Fatalf(
			"unexpected usage attempts: %d",
			usage.Attempts,
		)
	}
}

func TestEdgeProviderRejectsOddPCMByteCount(
	t *testing.T,
) {
	t.Parallel()

	provider :=
		&EdgeProvider{
			language: "en-US",

			voice: "en-US-AriaNeural",

			timeout: time.Second,

			maxRetries: 0,

			usageRecorder: NoopUsageRecorder{},

			retryDelay: func(
				int,
			) time.Duration {
				return 0
			},

			synthesize: func(
				context.Context,
				string,
			) ([]byte, error) {
				return []byte{
					0x01,
					0x02,
					0x03,
				}, nil
			},
		}

	_, err :=
		provider.Synthesize(
			context.Background(),
			"Bad PCM",
		)

	if err == nil {
		t.Fatal(
			"expected invalid PCM failure",
		)
	}
}
