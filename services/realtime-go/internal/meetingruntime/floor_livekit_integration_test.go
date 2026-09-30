package meetingruntime

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/livekit/protocol/auth"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"lumos/realtime-go/internal/livekitclient"
	"lumos/realtime-go/internal/speechfloor"
	"lumos/realtime-go/internal/transcription"
)

// Uses an isolated LiveKit room and the same demo grants as the API. Opt in
// explicitly; there is no PostgreSQL meeting, Jira issue or transcription.
func TestLiveKitFloorGrantWithDemoPermissions(t *testing.T) {
	if os.Getenv("RUN_LIVEKIT_INTEGRATION") != "1" {
		t.Skip("RUN_LIVEKIT_INTEGRATION is not enabled")
	}
	env, err := godotenv.Read("../../../../.env")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := livekitclient.New(env["LIVEKIT_URL"], env["LIVEKIT_API_KEY"], env["LIVEKIT_API_SECRET"])
	if err != nil {
		t.Fatal(err)
	}
	roomName := "floor-test-" + uuid.NewString()
	manager := transcription.NewManager(ctx, roomName, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	floor := speechfloor.New(time.Millisecond)
	manager.ConfigureFloor(floor)
	bot, err := client.ConnectToRoom(roomName, "floor-bot", manager)
	if err != nil {
		t.Fatal(err)
	}
	defer bot.Disconnect()
	configureFloorReply(bot, manager)
	t.Cleanup(func() {
		api, err := lksdk.NewLiveKitAPI(lksdk.WithURL(env["LIVEKIT_URL"]),
			lksdk.WithAPIKey(env["LIVEKIT_API_KEY"], env["LIVEKIT_API_SECRET"]))
		if err != nil {
			t.Error(err)
			return
		}
		cleanupCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if _, err := api.Room().DeleteRoom(cleanupCtx, &livekit.DeleteRoomRequest{Room: roomName}); err != nil {
			t.Error(err)
		}
	})
	yes := true
	token, err := auth.NewAccessToken(env["LIVEKIT_API_KEY"], env["LIVEKIT_API_SECRET"]).
		SetIdentity("demo:actor").SetVideoGrant(&auth.VideoGrant{RoomJoin: true, Room: roomName,
		CanPublish: &yes, CanSubscribe: &yes, CanPublishData: &yes}).ToJWT()
	if err != nil {
		t.Fatal(err)
	}
	replies := make(chan string, 16)
	actor, err := lksdk.ConnectToRoomWithToken(env["LIVEKIT_URL"], token, &lksdk.RoomCallback{
		ParticipantCallback: lksdk.ParticipantCallback{OnDataPacket: func(packet lksdk.DataPacket, params lksdk.DataReceiveParams) {
			data, ok := packet.(*lksdk.UserDataPacket)
			if ok {
				t.Logf("floor packet: topic=%q sender=%q senderPresent=%v", data.Topic, params.SenderIdentity, params.Sender != nil)
			}
			if !ok || data.Topic != transcription.FloorTopic || params.Sender == nil ||
				params.Sender.Metadata() != `{"type":"lumos-runtime"}` {
				return
			}
			var reply struct {
				Type      string `json:"type"`
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(data.Payload, &reply) == nil && reply.RequestID == "wav" {
				select {
				case replies <- reply.Type:
				default:
				}
			}
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer actor.Disconnect()
	send := func(kind string) {
		t.Helper()
		data, _ := json.Marshal(map[string]string{"type": kind, "requestId": "wav"})
		if err := actor.LocalParticipant.PublishDataPacket(&lksdk.UserDataPacket{Payload: data, Topic: transcription.FloorTopic},
			lksdk.WithDataPublishReliable(true)); err != nil {
			t.Fatal(err)
		}
	}
	awaitReply := func(want string) {
		t.Helper()
		select {
		case actual := <-replies:
			if actual != want {
				t.Fatalf("want %s got %s", want, actual)
			}
		case <-ctx.Done():
			t.Fatal("floor handshake failed: ", ctx.Err())
		}
	}
	_, release, err := floor.Acquire(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	send("acquire")
	awaitReply("busy")
	release()
	send("acquire")
	awaitReply("granted")
	send("heartbeat")
	awaitReply("granted")
	send("release")
}
