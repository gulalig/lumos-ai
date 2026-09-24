package tts

import (
	"encoding/binary"
	"testing"
)

func TestPCM16LEToFrames(
	t *testing.T,
) {
	t.Parallel()

	raw :=
		make(
			[]byte,
			8,
		)

	binary.LittleEndian.PutUint16(
		raw[0:2],
		uint16(1),
	)

	binary.LittleEndian.PutUint16(
		raw[2:4],
		uint16(2),
	)

	binary.LittleEndian.PutUint16(
		raw[4:6],
		uint16(32767),
	)

	binary.LittleEndian.PutUint16(
		raw[6:8],
		uint16(0xffff),
	)

	frames,
		err :=
		PCM16LEToFrames(
			raw,
			22050,
			1,
		)
	if err != nil {
		t.Fatalf(
			"PCM16LEToFrames returned error: %v",
			err,
		)
	}

	if len(frames) != 1 {
		t.Fatalf(
			"expected one frame, got %d",
			len(frames),
		)
	}

	frame :=
		frames[0]

	if len(frame) != 4 {
		t.Fatalf(
			"expected four samples, got %d",
			len(frame),
		)
	}

	if frame[0] != 1 {
		t.Fatalf(
			"unexpected first sample: %d",
			frame[0],
		)
	}

	if frame[1] != 2 {
		t.Fatalf(
			"unexpected second sample: %d",
			frame[1],
		)
	}

	if frame[2] != 32767 {
		t.Fatalf(
			"unexpected third sample: %d",
			frame[2],
		)
	}

	if frame[3] != -1 {
		t.Fatalf(
			"unexpected fourth sample: %d",
			frame[3],
		)
	}
}

func TestPCM16LEToFramesRejectsOddByteCount(
	t *testing.T,
) {
	t.Parallel()

	_,
		err :=
		PCM16LEToFrames(
			[]byte{
				0x01,
				0x02,
				0x03,
			},
			22050,
			1,
		)

	if err == nil {
		t.Fatal(
			"expected odd byte count error",
		)
	}
}

func TestPCM16LEToFramesSplitsIntoTwentyMillisecondFrames(
	t *testing.T,
) {
	t.Parallel()

	const sampleRate = 22050

	const channels = 1

	const expectedFrameSamples = 441

	const totalSamples = expectedFrameSamples +
		10

	raw :=
		make(
			[]byte,
			totalSamples*2,
		)

	frames,
		err :=
		PCM16LEToFrames(
			raw,
			sampleRate,
			channels,
		)
	if err != nil {
		t.Fatalf(
			"PCM16LEToFrames returned error: %v",
			err,
		)
	}

	if len(frames) != 2 {
		t.Fatalf(
			"expected two frames, got %d",
			len(frames),
		)
	}

	if len(frames[0]) !=
		expectedFrameSamples {

		t.Fatalf(
			"unexpected first frame size: %d",
			len(frames[0]),
		)
	}

	if len(frames[1]) != 10 {
		t.Fatalf(
			"unexpected second frame size: %d",
			len(frames[1]),
		)
	}
}
