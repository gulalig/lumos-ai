package livekitclient

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/pion/webrtc/v4"

	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

type Client struct {
	api *lksdk.LiveKitAPI

	realtimeURL string
	apiKey      string
	apiSecret   string
}

type TrackHandler interface {
	HandleTrackSubscribed(
		track *webrtc.TrackRemote,
		publication *lksdk.RemoteTrackPublication,
		participant *lksdk.RemoteParticipant,
	)

	HandleTrackUnsubscribed(
		track *webrtc.TrackRemote,
		publication *lksdk.RemoteTrackPublication,
		participant *lksdk.RemoteParticipant,
	)
}

func New(
	url string,
	apiKey string,
	apiSecret string,
) (*Client, error) {
	apiURL := normalizeAPIURL(url)

	api, err := lksdk.NewLiveKitAPI(
		lksdk.WithURL(apiURL),
		lksdk.WithAPIKey(apiKey, apiSecret),
	)
	if err != nil {
		return nil, fmt.Errorf("create livekit client: %w", err)
	}

	return &Client{
		api:         api,
		realtimeURL: url,
		apiKey:      apiKey,
		apiSecret:   apiSecret,
	}, nil
}

func (c *Client) Check(ctx context.Context) error {
	_, err := c.api.Room().ListRooms(
		ctx,
		&livekit.ListRoomsRequest{},
	)
	if err != nil {
		return fmt.Errorf("livekit connectivity check: %w", err)
	}

	return nil
}

func (c *Client) ConnectToRoom(
	roomName string,
	identity string,
	handler TrackHandler,
) (*lksdk.Room, error) {
	callback := &lksdk.RoomCallback{
		OnParticipantDisconnected: func(participant *lksdk.RemoteParticipant) {
			if h, ok := handler.(interface{ HandleParticipantDisconnected(string) }); ok {
				h.HandleParticipantDisconnected(participant.Identity())
			}
		},
		ParticipantCallback: lksdk.ParticipantCallback{
			OnDataPacket: func(packet lksdk.DataPacket, params lksdk.DataReceiveParams) {
				if h, ok := handler.(interface {
					HandleDataPacket(lksdk.DataPacket, lksdk.DataReceiveParams)
				}); ok {
					h.HandleDataPacket(packet, params)
				}
			},
			OnTrackSubscribed: func(
				track *webrtc.TrackRemote,
				publication *lksdk.RemoteTrackPublication,
				participant *lksdk.RemoteParticipant,
			) {
				slog.Info(
					"LiveKit track subscribed",
					"participant", participant.Identity(),
					"trackId", publication.SID(),
					"codec", track.Codec().MimeType,
				)

				if handler != nil {
					handler.HandleTrackSubscribed(
						track,
						publication,
						participant,
					)
				}
			},

			OnTrackUnsubscribed: func(
				track *webrtc.TrackRemote,
				publication *lksdk.RemoteTrackPublication,
				participant *lksdk.RemoteParticipant,
			) {
				if handler != nil {
					handler.HandleTrackUnsubscribed(
						track,
						publication,
						participant,
					)
				}
			},
		},
	}

	room, err := lksdk.ConnectToRoom(
		c.realtimeURL,
		lksdk.ConnectInfo{
			APIKey:              c.apiKey,
			APISecret:           c.apiSecret,
			RoomName:            roomName,
			ParticipantIdentity: identity,
			ParticipantMetadata: `{"type":"lumos-runtime"}`,
		},
		callback,
	)
	if err != nil {
		return nil, fmt.Errorf("connect to livekit room: %w", err)
	}

	return room, nil
}

func normalizeAPIURL(rawURL string) string {
	switch {
	case strings.HasPrefix(rawURL, "wss://"):
		return "https://" + strings.TrimPrefix(rawURL, "wss://")

	case strings.HasPrefix(rawURL, "ws://"):
		return "http://" + strings.TrimPrefix(rawURL, "ws://")

	default:
		return rawURL
	}
}
