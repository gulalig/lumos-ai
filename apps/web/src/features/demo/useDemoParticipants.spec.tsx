// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoParticipants } from "./useDemoParticipants";
import { DemoRoomLifecycle } from "./demoRoomLifecycle";

const mocks = vi.hoisted(() => ({
  rooms: [] as FakeRoom[],
  sources: [] as FakeSource[],
  events: [] as string[],
  connect: undefined as (() => Promise<void>) | undefined,
  unpublish: undefined as (() => Promise<void>) | undefined,
  release: undefined as (() => Promise<void>) | undefined,
  grant: true,
}));
interface FakeSource {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}
interface FakeRoom {
  state: string;
  disconnect: ReturnType<typeof vi.fn>;
  emit: (event: string) => void;
  localParticipant: {
    unpublishTrack: ReturnType<typeof vi.fn>;
    publishTrack: ReturnType<typeof vi.fn>;
    publishData: ReturnType<typeof vi.fn>;
  };
}
vi.mock("@/store/hooks", () => ({ useAppSelector: () => "test-token" }));
vi.mock("@/lib/livekit", () => ({
  getDemoLiveKitConnectionDetails: vi.fn(async () => ({
    serverUrl: "wss://test",
    participantToken: "token",
  })),
}));
// The floor module is intentionally real: grants still control source.start().
vi.mock("livekit-client", () => ({
  ConnectionState: {
    Connected: "connected",
    Connecting: "connecting",
    Disconnected: "disconnected",
  },
  RoomEvent: {
    Disconnected: "disconnected",
    ConnectionStateChanged: "state",
    DataReceived: "data",
  },
  Track: { Source: { Microphone: "microphone" } },
  LocalAudioTrack: class {
    constructor(private media: { stop: () => void }) {}
    stop() {
      this.media.stop();
      mocks.events.push("track-stop");
    }
  },
  Room: class {
    state = "disconnected";
    listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    publication: { track: unknown } | undefined;
    constructor() {
      mocks.rooms.push(this);
    }
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event)!.add(fn);
    }
    off(event: string, fn: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(fn);
    }
    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.forEach((fn) => fn(...args));
    }
    async connect() {
      this.state = "connecting";
      this.emit("state");
      await mocks.connect?.();
      if (this.state === "disconnected")
        throw new DOMException("Aborted", "AbortError");
      this.state = "connected";
      this.emit("state");
    }
    disconnect = vi.fn(async () => {
      mocks.events.push("disconnect");
      this.state = "disconnected";
      this.emit("disconnected");
    });
    localParticipant = {
      getTrackPublicationByName: () => this.publication,
      publishTrack: vi.fn(async (track: unknown) => {
        expect(this.state).toBe("connected");
        this.publication = { track };
        mocks.events.push("publish");
      }),
      unpublishTrack: vi.fn(async (_track: unknown, stop: boolean) => {
        expect(this.state).toBe("connected");
        expect(stop).toBe(false);
        mocks.events.push("unpublish");
        await mocks.unpublish?.();
        this.publication = undefined;
      }),
      publishData: vi.fn(async (payload: Uint8Array) => {
        expect(this.state).toBe("connected");
        const packet = JSON.parse(new TextDecoder().decode(payload));
        mocks.events.push(packet.type);
        if (packet.type === "release") await mocks.release?.();
        if (packet.type !== "release" && mocks.grant) {
          this.emit(
            "data",
            new TextEncoder().encode(
              JSON.stringify({
                type: "granted",
                requestId: packet.requestId,
              }),
            ),
            { metadata: '{"type":"lumos-runtime"}' },
            undefined,
            "lumos.floor.v1",
          );
        }
      }),
    };
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let contexts: { close: ReturnType<typeof vi.fn> }[];
beforeEach(() => {
  vi.useFakeTimers();
  mocks.rooms.length = 0;
  mocks.sources.length = 0;
  mocks.events.length = 0;
  mocks.connect = undefined;
  mocks.unpublish = undefined;
  mocks.release = undefined;
  mocks.grant = true;
  contexts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    })),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      constructor() {
        contexts.push(this);
      }
      resume = async () => {};
      decodeAudioData = async () => ({});
      createBufferSource() {
        const source = {
          buffer: undefined,
          onended: null as (() => void) | null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(() => {
            mocks.events.push("source-start");
          }),
          stop: vi.fn(() => {
            mocks.events.push("source-stop");
          }),
        };
        mocks.sources.push(source);
        return source;
      }
      createMediaStreamDestination() {
        const track = {
          readyState: "live",
          stop: vi.fn(() => {
            track.readyState = "ended";
          }),
        };
        return { stream: { getAudioTracks: () => [track] } };
      }
      close = vi.fn(async () => {
        this.state = "closed";
        mocks.events.push("context-close");
      });
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function start(result: {
  current: ReturnType<typeof useDemoParticipants>;
}) {
  let task!: Promise<void>;
  await act(async () => {
    task = result.current.startDemoParticipants();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1200);
  });
  return { task };
}
function mount() {
  return renderHook(() =>
    useDemoParticipants({ meetingId: "meeting", meetingConnected: true }),
  );
}

describe("demo playback lifecycle", () => {
  it("supports Strict Mode auto-start without restarting during meeting ending", async () => {
    const { result } = renderHook(
      () => {
      const demo = useDemoParticipants({
        meetingId: "meeting",
        meetingConnected: true,
      });
      const { status, startDemoParticipants } = demo;
      useEffect(() => {
        if (status === "idle") void startDemoParticipants();
      }, [status, startDemoParticipants]);
        return demo;
      },
      { wrapper: StrictMode },
    );
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(mocks.sources).toHaveLength(1);
    await act(async () => {
      await result.current.stopDemoParticipants();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.status).toBe("finished");
    expect(mocks.sources).toHaveLength(1);
    expect(mocks.rooms).toHaveLength(1);
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
  });

  it("finishes all WAVs, releasing tracks/floor before a single disconnect per actor", async () => {
    const { result } = mount();
    const { task } = await start(result);
    for (const delay of [800, 900, 800, 0]) {
      expect(mocks.sources.at(-1)!.start).toHaveBeenCalledOnce();
      await act(async () => {
        mocks.sources.at(-1)!.onended!();
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    await act(async () => {
      await task;
    });
    expect(result.current.status).toBe("finished");
    expect(mocks.rooms).toHaveLength(2);
    for (const room of mocks.rooms) {
      expect(room.disconnect).toHaveBeenCalledOnce();
      expect(room.localParticipant.unpublishTrack).toHaveBeenCalledTimes(2);
    }
    expect(
      contexts.every((context) => context.close.mock.calls.length === 1),
    ).toBe(true);
    expect(mocks.events.slice(-3)).toEqual([
      "context-close",
      "disconnect",
      "disconnect",
    ]);
    await act(async () => {
      await result.current.stopDemoParticipants();
    });
    expect(
      mocks.rooms.every((room) => room.disconnect.mock.calls.length === 1),
    ).toBe(true);
  });

  it("concurrent Stop/unmount is idempotent and cannot disconnect or restart during unpublish", async () => {
    const gate = deferred();
    const { result, unmount } = mount();
    const { task } = await start(result);
    mocks.unpublish = () => gate.promise;
    let stops!: Promise<void[]>;
    await act(async () => {
      stops = Promise.all([
        result.current.stopDemoParticipants(),
        result.current.stopDemoParticipants(),
      ]);
    });
    expect(result.current.status).toBe("stopping");
    expect(mocks.sources[0].stop).toHaveBeenCalledOnce();
    expect(mocks.rooms[0].disconnect).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.startDemoParticipants();
    });
    expect(mocks.rooms).toHaveLength(1);
    unmount();
    gate.resolve();
    await act(async () => {
      await stops;
      await task;
    });
    expect(
      mocks.rooms[0].localParticipant.unpublishTrack,
    ).toHaveBeenCalledOnce();
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    expect(mocks.events.indexOf("context-close")).toBeLessThan(
      mocks.events.indexOf("disconnect"),
    );
  });

  it("does not start a WAV without a runtime floor grant and Stop cleans the waiting track", async () => {
    mocks.grant = false;
    const { result } = mount();
    const { task } = await start(result);
    expect(mocks.sources[0].start).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.stopDemoParticipants();
      await task;
    });
    expect(
      mocks.rooms[0].localParticipant.unpublishTrack,
    ).toHaveBeenCalledOnce();
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("finished");
  });

  it("does not unpublish, send floor data, or disconnect an already closed Room; surfaces real failure", async () => {
    const { result } = mount();
    const { task } = await start(result);
    const room = mocks.rooms[0];
    const sent = room.localParticipant.publishData.mock.calls.length;
    await act(async () => {
      room.state = "disconnected";
      room.emit("disconnected");
      await task;
    });
    expect(mocks.sources[0].stop).toHaveBeenCalledOnce();
    expect(room.localParticipant.publishData).toHaveBeenCalledTimes(sent);
    expect(room.localParticipant.unpublishTrack).not.toHaveBeenCalled();
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/disconnected unexpectedly/);
  });

  it("registers a pending connection for abort and disconnects it only once", async () => {
    const gate = deferred();
    mocks.connect = () => gate.promise;
    const { result } = mount();
    const { task } = await start(result);
    let stop!: Promise<void>;
    await act(async () => {
      stop = result.current.stopDemoParticipants();
    });
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    gate.resolve();
    await act(async () => {
      await stop;
      await task;
    });
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    expect(mocks.sources).toHaveLength(0);
  });

  it("awaits a floor release initiated by abort before disconnecting its transport", async () => {
    const gate = deferred();
    const { result } = mount();
    const { task } = await start(result);
    mocks.release = () => gate.promise;
    let stop!: Promise<void>;
    await act(async () => {
      stop = result.current.stopDemoParticipants();
    });
    expect(mocks.rooms[0].disconnect).not.toHaveBeenCalled();
    gate.resolve();
    await act(async () => {
      await stop;
      await task;
    });
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    expect(mocks.events.filter((event) => event === "release")).toHaveLength(1);
  });

  it("shares disposal across callers and rejects reuse of a disconnected actor", async () => {
    const lifecycle = new DemoRoomLifecycle(vi.fn());
    await lifecycle.connect(
      "maya",
      "wss://test",
      "token",
      new AbortController().signal,
    );
    const disposal = lifecycle.dispose();
    expect(lifecycle.dispose()).toBe(disposal);
    await disposal;
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledOnce();
    expect(() => lifecycle.get("maya")).toThrow(/not connected/);
  });
});
