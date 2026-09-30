import { ConnectionState, Room, RoomEvent } from "livekit-client";
import type { DemoActor } from "@/lib/livekit";

interface ActorRoom {
  room: Room;
  closing: boolean;
  disconnect?: Promise<void>;
  onDisconnected: () => void;
}

// One owner per playback run. Intentional teardown happens only after that
// run's media cleanup; canceling a pending connection is the sole exception.
export class DemoRoomLifecycle {
  private readonly actors = new Map<DemoActor, ActorRoom>();
  private disposal?: Promise<void>;

  constructor(
    private readonly onUnexpectedDisconnect: (error: Error) => void,
  ) {}

  get(actor: DemoActor): Room | undefined {
    const entry = this.actors.get(actor);
    if (
      entry &&
      (entry.closing || entry.room.state !== ConnectionState.Connected)
    ) {
      throw new Error("Demo participant " + actor + " is not connected");
    }
    return entry?.room;
  }

  async connect(
    actor: DemoActor,
    serverUrl: string,
    token: string,
    signal: AbortSignal,
  ): Promise<Room> {
    signal.throwIfAborted();
    if (this.disposal) throw new Error("Demo participant cleanup has started");
    const room = new Room({ adaptiveStream: false, dynacast: false });
    const entry: ActorRoom = {
      room,
      closing: false,
      onDisconnected: () => {
        if (!entry.closing && !signal.aborted) {
          this.onUnexpectedDisconnect(
            new Error(
              "Demo participant " + actor + " disconnected unexpectedly",
            ),
          );
        }
      },
    };
    this.actors.set(actor, entry);
    room.on(RoomEvent.Disconnected, entry.onDisconnected);
    // Room.connect can be between its initial await and Connecting state when
    // abort fires. The state listener also catches that early cancellation.
    const cancelConnection = () => {
      if (!entry.closing && room.state !== ConnectionState.Disconnected) {
        void this.close(entry).catch(() => {
          /* dispose() awaits and reports the same cleanup failure. */
        });
      }
    };
    const onState = () => {
      if (signal.aborted) cancelConnection();
    };
    signal.addEventListener("abort", cancelConnection, { once: true });
    room.on(RoomEvent.ConnectionStateChanged, onState);
    try {
      await room.connect(serverUrl, token);
      signal.throwIfAborted();
      if (room.state !== ConnectionState.Connected || entry.closing) {
        throw new Error("Demo participant " + actor + " did not connect");
      }
      return room;
    } finally {
      signal.removeEventListener("abort", cancelConnection);
      room.off(RoomEvent.ConnectionStateChanged, onState);
    }
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposal = (async () => {
        const results = await Promise.allSettled(
          [...this.actors.values()].map((entry) => this.close(entry)),
        );
        const failure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failure) throw failure.reason;
      })();
    }
    return this.disposal;
  }

  private close(entry: ActorRoom): Promise<void> {
    if (!entry.disconnect) {
      entry.closing = true;
      entry.room.off(RoomEvent.Disconnected, entry.onDisconnected);
      entry.disconnect =
        entry.room.state === ConnectionState.Disconnected
          ? Promise.resolve()
          : entry.room.disconnect();
    }
    return entry.disconnect;
  }
}
