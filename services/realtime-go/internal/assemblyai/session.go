package assemblyai

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	sessionStartTimeout = 10 * time.Second
	readLimitBytes      = 1 << 20
)

type Turn struct {
	TurnOrder    int    `json:"turn_order"`
	EndOfTurn    bool   `json:"end_of_turn"`
	Transcript   string `json:"transcript"`
	SpeakerLabel string `json:"speaker_label"`
}

type serverEvent struct {
	Type string `json:"type"`
	ID   string `json:"id"`

	TurnOrder    int    `json:"turn_order"`
	EndOfTurn    bool   `json:"end_of_turn"`
	Transcript   string `json:"transcript"`
	SpeakerLabel string `json:"speaker_label"`
}

type TurnHandler func(Turn)

type Session struct {
	conn   *websocket.Conn
	cancel context.CancelFunc

	begun chan struct{}
	done  chan struct{}

	beginOnce sync.Once
	closeOnce sync.Once

	errMu sync.RWMutex
	err   error

	onTurn TurnHandler
}

func (c *Client) OpenSession(
	ctx context.Context,
	onTurn TurnHandler,
) (*Session, error) {
	streamingURL, err := c.StreamingURL()
	if err != nil {
		return nil, err
	}

	sessionCtx, cancel := context.WithCancel(ctx)

	dialCtx, dialCancel := context.WithTimeout(
		sessionCtx,
		sessionStartTimeout,
	)

	conn, response, err := websocket.Dial(
		dialCtx,
		streamingURL,
		c.DialOptions(),
	)

	dialCancel()

	if err != nil {
		cancel()

		if response != nil {
			return nil, fmt.Errorf(
				"dial assemblyai websocket: status=%d: %w",
				response.StatusCode,
				err,
			)
		}

		return nil, fmt.Errorf(
			"dial assemblyai websocket: %w",
			err,
		)
	}

	conn.SetReadLimit(readLimitBytes)

	session := &Session{
		conn:   conn,
		cancel: cancel,
		begun:  make(chan struct{}),
		done:   make(chan struct{}),
		onTurn: onTurn,
	}

	go session.readLoop(sessionCtx)

	timer := time.NewTimer(sessionStartTimeout)
	defer timer.Stop()

	select {
	case <-session.begun:
		return session, nil

	case <-session.done:
		_ = conn.CloseNow()
		cancel()

		if err := session.Err(); err != nil {
			return nil, err
		}

		return nil, fmt.Errorf(
			"assemblyai session ended before Begin event",
		)

	case <-timer.C:
		_ = conn.CloseNow()
		cancel()

		return nil, fmt.Errorf(
			"timeout waiting for assemblyai Begin event",
		)

	case <-ctx.Done():
		_ = conn.CloseNow()
		cancel()

		return nil, ctx.Err()
	}
}

func (s *Session) WriteAudio(
	ctx context.Context,
	audio []byte,
) error {
	if len(audio) == 0 {
		return nil
	}

	if err := s.conn.Write(
		ctx,
		websocket.MessageBinary,
		audio,
	); err != nil {
		return fmt.Errorf(
			"write assemblyai audio: %w",
			err,
		)
	}

	return nil
}

func (s *Session) Close(ctx context.Context) error {
	var closeErr error

	s.closeOnce.Do(func() {
		payload := []byte(`{"type":"Terminate"}`)

		if err := s.conn.Write(
			ctx,
			websocket.MessageText,
			payload,
		); err != nil {
			closeErr = fmt.Errorf(
				"send assemblyai termination: %w",
				err,
			)

			s.cancel()
			_ = s.conn.CloseNow()

			return
		}

		select {
		case <-s.done:
		case <-ctx.Done():
			closeErr = ctx.Err()
		}

		s.cancel()

		if closeErr != nil {
			_ = s.conn.CloseNow()
			return
		}

		_ = s.conn.Close(
			websocket.StatusNormalClosure,
			"",
		)
	})

	return closeErr
}

func (s *Session) Err() error {
	s.errMu.RLock()
	defer s.errMu.RUnlock()

	return s.err
}

func (s *Session) readLoop(ctx context.Context) {
	defer close(s.done)

	for {
		messageType, payload, err := s.conn.Read(ctx)
		if err != nil {
			if ctx.Err() == nil {
				s.setErr(
					fmt.Errorf(
						"read assemblyai websocket: %w",
						err,
					),
				)
			}

			return
		}

		if messageType != websocket.MessageText {
			continue
		}

		var event serverEvent

		if err := json.Unmarshal(payload, &event); err != nil {
			s.setErr(
				fmt.Errorf(
					"decode assemblyai event: %w",
					err,
				),
			)

			return
		}

		switch event.Type {
		case "Begin":
			s.beginOnce.Do(func() {
				close(s.begun)
			})

		case "Turn":
			if s.onTurn == nil {
				continue
			}

			s.onTurn(Turn{
				TurnOrder:    event.TurnOrder,
				EndOfTurn:    event.EndOfTurn,
				Transcript:   event.Transcript,
				SpeakerLabel: event.SpeakerLabel,
			})

		case "Termination":
			return
		}
	}
}

func (s *Session) setErr(err error) {
	s.errMu.Lock()
	defer s.errMu.Unlock()

	if s.err == nil {
		s.err = err
	}
}
