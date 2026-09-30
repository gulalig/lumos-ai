import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireFloor,
  type FloorReply,
  type FloorTransport,
} from "./floorLease";

function fixture() {
  let receive: (reply: FloorReply) => void = () => {};
  const send = vi.fn<FloorTransport["send"]>().mockResolvedValue(undefined);
  const unlisten = vi.fn();
  const transport: FloorTransport = {
    send,
    listen: (handler) => {
      receive = handler;
      return unlisten;
    },
  };
  return {
    transport,
    send,
    unlisten,
    reply: (type: FloorReply["type"], requestId?: string) =>
      receive({ type, requestId: requestId ?? send.mock.calls[0][1] }),
  };
}

describe("demo audio floor", () => {
  afterEach(() => vi.useRealTimers());
  it("does not start WAV playback while Lumos holds the floor, then plays after a server grant", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const startWav = vi.fn();
    const waiting = acquireFloor(f.transport, new AbortController().signal);
    const playback = waiting.then((lease) => {
      startWav();
      return lease;
    });
    f.reply("busy");
    await vi.advanceTimersByTimeAsync(1000);
    expect(startWav).not.toHaveBeenCalled();
    f.reply("granted", "wrong-request");
    await Promise.resolve();
    expect(startWav).not.toHaveBeenCalled();
    f.reply("granted");
    const lease = await playback;
    expect(startWav).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.send).toHaveBeenCalledWith("heartbeat", f.send.mock.calls[0][1]);
    f.reply("granted");
    await lease.release();
    expect(f.send).toHaveBeenLastCalledWith("release", f.send.mock.calls[0][1]);
    expect(f.unlisten).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts playback when the authoritative floor lease is lost", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const waiting = acquireFloor(f.transport, new AbortController().signal);
    f.reply("granted");
    const lease = await waiting;
    await vi.advanceTimersByTimeAsync(2600);
    expect(lease.signal.aborted).toBe(true);
    expect(f.unlisten).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a waiting WAV without playing or leaving a reservation", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const controller = new AbortController();
    const waiting = acquireFloor(f.transport, controller.signal);
    const rejected = expect(waiting).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(f.send).toHaveBeenLastCalledWith("release", f.send.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
