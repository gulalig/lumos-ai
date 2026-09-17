package transcription

import (
	"context"
	"encoding/binary"
	"errors"
	"sync"
	"time"

	"lumos/realtime-go/internal/assemblyai"
)

const (
	targetSampleRate = 16000
	targetChannels   = 1

	chunkDuration    = 100 * time.Millisecond
	minChunkDuration = 50 * time.Millisecond

	audioWriteTimeout   = 2 * time.Second
	sessionCloseTimeout = 5 * time.Second
)

var errPCMChunkerClosed = errors.New(
	"pcm chunker is closed",
)

type pcmChunker struct {
	ctx     context.Context
	session *assemblyai.Session

	mu      sync.Mutex
	pending []int16
	closed  bool
}

func newPCMChunker(
	ctx context.Context,
	session *assemblyai.Session,
) *pcmChunker {
	return &pcmChunker{
		ctx:     ctx,
		session: session,
		pending: make(
			[]int16,
			0,
			samplesForDuration(chunkDuration),
		),
	}
}

func (c *pcmChunker) Write(samples []int16) error {
	c.mu.Lock()

	if c.closed {
		c.mu.Unlock()
		return errPCMChunkerClosed
	}

	c.pending = append(c.pending, samples...)

	chunkSize := samplesForDuration(chunkDuration)

	var chunks [][]int16

	for len(c.pending) >= chunkSize {
		chunk := make([]int16, chunkSize)

		copy(chunk, c.pending[:chunkSize])

		c.pending = c.pending[chunkSize:]

		chunks = append(chunks, chunk)
	}

	c.mu.Unlock()

	for _, chunk := range chunks {
		if err := c.send(c.ctx, chunk); err != nil {
			return err
		}
	}

	return nil
}

func (c *pcmChunker) Close() error {
	c.mu.Lock()

	if c.closed {
		c.mu.Unlock()
		return nil
	}

	c.closed = true

	tail := append(
		[]int16(nil),
		c.pending...,
	)

	c.pending = nil

	c.mu.Unlock()

	var audioErr error

	if len(tail) > 0 {
		minSamples := samplesForDuration(
			minChunkDuration,
		)

		if len(tail) < minSamples {
			tail = append(
				tail,
				make([]int16, minSamples-len(tail))...,
			)
		}

		ctx, cancel := context.WithTimeout(
			context.Background(),
			audioWriteTimeout,
		)

		audioErr = c.send(ctx, tail)

		cancel()
	}

	closeCtx, cancel := context.WithTimeout(
		context.Background(),
		sessionCloseTimeout,
	)
	defer cancel()

	sessionErr := c.session.Close(closeCtx)

	return errors.Join(
		audioErr,
		sessionErr,
	)
}

func (c *pcmChunker) send(
	parent context.Context,
	samples []int16,
) error {
	payload := make([]byte, len(samples)*2)

	for index, sample := range samples {
		binary.LittleEndian.PutUint16(
			payload[index*2:],
			uint16(sample),
		)
	}

	ctx, cancel := context.WithTimeout(
		parent,
		audioWriteTimeout,
	)
	defer cancel()

	return c.session.WriteAudio(
		ctx,
		payload,
	)
}

func samplesForDuration(
	duration time.Duration,
) int {
	return int(
		time.Duration(targetSampleRate) *
			duration /
			time.Second,
	)
}
