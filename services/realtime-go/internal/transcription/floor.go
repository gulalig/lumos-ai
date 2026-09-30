package transcription

import (
	"encoding/json"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"lumos/realtime-go/internal/speechfloor"
)

const FloorTopic = "lumos.floor.v1"

// ConfigureFloor is called before tracks are subscribed.
func (m *Manager) ConfigureFloor(floor *speechfloor.Floor) { m.floor = floor }

func (m *Manager) ConfigureFloorReply(reply func(string, string, bool) error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.floorReply = reply
}

func (m *Manager) observePCM(track string) func([]int16) {
	if m.floor == nil {
		return nil
	}
	return func(samples []int16) { m.floor.PCM(track, samples) }
}

func (m *Manager) HandleParticipantDisconnected(identity string) {
	if m.floor != nil {
		m.floor.Disconnect(identity)
	}
}

func (m *Manager) HandleDataPacket(packet lksdk.DataPacket, params lksdk.DataReceiveParams) {
	data, ok := packet.(*lksdk.UserDataPacket)
	if !ok || data.Topic != FloorTopic || m.floor == nil || params.SenderIdentity == "" || len(data.Payload) > 1024 {
		return
	}
	var request struct {
		Type      string `json:"type"`
		RequestID string `json:"requestId"`
	}
	if json.Unmarshal(data.Payload, &request) != nil || request.RequestID == "" || len(request.RequestID) > 128 {
		return
	}
	identity := params.SenderIdentity // never trust identity supplied in data
	if request.Type == "release" {
		m.floor.Release(identity, request.RequestID)
		return
	}
	if request.Type != "acquire" && request.Type != "heartbeat" {
		return
	}
	m.mu.Lock()
	reply := m.floorReply
	m.mu.Unlock()
	if reply == nil {
		return
	} // not ready; client retries instead of starting audio
	granted := m.floor.TryReserve(identity, request.RequestID)
	if err := reply(identity, request.RequestID, granted); err != nil {
		if granted {
			m.floor.Release(identity, request.RequestID)
		}
		m.logger.Warn("floor reply failed", "participant", identity, "error", err)
	}
}
