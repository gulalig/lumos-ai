package tts

import (
	"encoding/binary"
	"fmt"

	media "github.com/livekit/media-sdk"
)

const defaultFrameDurationMilliseconds = 20

func PCM16LEToFrames(
	raw []byte,
	sampleRate int,
	channels int,
) ([]media.PCM16Sample, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf(
			"PCM input is empty",
		)
	}

	if len(raw)%2 != 0 {
		return nil, fmt.Errorf(
			"PCM16 byte count must be even, got %d",
			len(raw),
		)
	}

	if sampleRate <= 0 {
		return nil, fmt.Errorf(
			"PCM sample rate must be positive",
		)
	}

	if channels <= 0 ||
		channels > 2 {

		return nil, fmt.Errorf(
			"PCM channels must be 1 or 2",
		)
	}

	sampleCount :=
		len(raw) / 2

	values :=
		make(
			[]int16,
			sampleCount,
		)

	for index := 0; index < sampleCount; index++ {
		offset :=
			index * 2

		values[index] =
			int16(
				binary.LittleEndian.Uint16(
					raw[offset : offset+2],
				),
			)
	}

	frameSamples :=
		(sampleRate * channels * defaultFrameDurationMilliseconds) / 1000

	if frameSamples <= 0 {
		return nil, fmt.Errorf(
			"calculated PCM frame size is invalid",
		)
	}

	frameCount :=
		(len(values) + frameSamples - 1) / frameSamples

	frames :=
		make(
			[]media.PCM16Sample,
			0,
			frameCount,
		)

	for start := 0; start < len(values); start += frameSamples {

		end :=
			start +
				frameSamples

		if end >
			len(values) {

			end =
				len(values)
		}

		frame :=
			make(
				media.PCM16Sample,
				end-start,
			)

		copy(frame, values[start:end])

		frames =
			append(
				frames,
				frame,
			)
	}

	return frames, nil
}
