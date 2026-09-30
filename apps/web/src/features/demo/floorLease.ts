export interface FloorReply {
  type: "granted" | "busy";
  requestId: string;
}

export interface FloorTransport {
  send: (
    type: "acquire" | "heartbeat" | "release",
    requestId: string,
  ) => Promise<void>;
  listen: (receive: (reply: FloorReply) => void) => () => void;
}

export interface FloorLease {
  signal: AbortSignal;
  release: () => Promise<void>;
}

// The server arbitrates audio. Client timers only retry the handshake and
// maintain its lease; they never decide that the floor is free.
export async function acquireFloor(
  transport: FloorTransport,
  signal: AbortSignal,
): Promise<FloorLease> {
  signal.throwIfAborted();
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  let granted = false;
  let stopped = false;
  let retry: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let unlisten = () => {};
  let rejectWait: (reason: unknown) => void = () => {};

  const release = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(retry);
    clearInterval(heartbeat);
    clearTimeout(watchdog);
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    unlisten();
    await transport.send("release", requestId).catch(() => {});
  };
  const fail = (reason: unknown) => {
    controller.abort(reason);
    rejectWait(reason);
    void release();
  };
  const abort = () => fail(signal.reason);
  signal.addEventListener("abort", abort, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      rejectWait = reject;
      const refreshWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(
          () => fail(new Error("Audio floor connection was lost")),
          2500,
        );
      };
      unlisten = transport.listen((reply) => {
        if (reply.requestId !== requestId || stopped) return;
        if (reply.type === "busy") {
          if (granted) fail(new Error("Audio floor lease expired"));
          return;
        }
        refreshWatchdog();
        if (granted) return;
        granted = true;
        clearInterval(retry);
        clearTimeout(timeout);
        heartbeat = setInterval(() => {
          void transport.send("heartbeat", requestId).catch(fail);
        }, 1000);
        resolve();
      });
      retry = setInterval(() => {
        void transport.send("acquire", requestId).catch(fail);
      }, 250);
      timeout = setTimeout(
        () => fail(new Error("Lumos audio coordination is unavailable")),
        30_000,
      );
      void transport.send("acquire", requestId).catch(fail);
    });
    controller.signal.throwIfAborted();
    return { signal: controller.signal, release };
  } catch (error) {
    await release();
    throw error;
  }
}
