"use client";

import {
  ConnectionState,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { getDemoLiveKitConnectionDetails, type DemoActor } from "@/lib/livekit";

import { useAppSelector } from "@/store/hooks";
import { acquireFloor, type FloorReply } from "./floorLease";
import { DemoRoomLifecycle } from "./demoRoomLifecycle";

type DemoParticipantStatus =
  "idle" | "preparing" | "playing" | "stopping" | "finished" | "error";

interface DemoRun {
  meetingId: string;
  controller: AbortController;
  rooms: DemoRoomLifecycle;
  task: Promise<void>;
  effectCleanup?: boolean;
}

interface UseDemoParticipantsInput {
  meetingId: string | null;

  meetingConnected: boolean;
}

interface UseDemoParticipantsResult {
  activeActor: DemoActor | null;

  status: DemoParticipantStatus;

  error: string | null;

  startDemoParticipants: () => Promise<void>;

  stopDemoParticipants: () => Promise<void>;
}

interface DemoLine {
  actor: DemoActor;

  audio: string;

  delayAfterMs: number;
}

const DEMO_SCRIPT: readonly DemoLine[] = [
  {
    actor: "alex",

    audio: "/demo-audio/alex-01.wav",

    delayAfterMs: 800,
  },

  {
    actor: "maya",

    audio: "/demo-audio/maya-01.wav",

    delayAfterMs: 900,
  },

  {
    actor: "alex",

    audio: "/demo-audio/alex-02.wav",

    delayAfterMs: 800,
  },

  {
    actor: "maya",

    audio: "/demo-audio/maya-02.wav",

    delayAfterMs: 0,
  },
];

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Demo playback aborted", "AbortError"));

      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);

      resolve();
    }, milliseconds);

    const handleAbort = () => {
      window.clearTimeout(timeout);

      reject(new DOMException("Demo playback aborted", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, {
      once: true,
    });
  });
}

async function loadAudioBuffer(
  context: AudioContext,
  url: string,
  signal: AbortSignal,
): Promise<AudioBuffer> {
  const response = await fetch(url, {
    signal,
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Unable to load demo audio ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return context.decodeAudioData(arrayBuffer);
}

export function useDemoParticipants({
  meetingId,
  meetingConnected,
}: UseDemoParticipantsInput): UseDemoParticipantsResult {
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const runRef = useRef<DemoRun | null>(null);
  const mountedRef = useRef(true);

  const [activeActor, setActiveActor] = useState<DemoActor | null>(null);

  const [status, setStatus] = useState<DemoParticipantStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  const stopDemoParticipants = useCallback(async () => {
    const run = runRef.current;
    if (!run) return;
    if (mountedRef.current) setStatus("stopping");
    run.controller.abort();
    // The run owns teardown. Never close a Room while its track/floor cleanup
    // is still in progress, or make another run eligible to start early.
    await run.task;
  }, []);

  const connectActor = useCallback(
    async (actor: DemoActor, run: DemoRun): Promise<Room> => {
      const signal = run.controller.signal;
      signal.throwIfAborted();
      if (!accessToken) {
        throw new Error("Authentication is required");
      }

      const existingRoom = run.rooms.get(actor);

      if (existingRoom) {
        return existingRoom;
      }

      const connection = await getDemoLiveKitConnectionDetails(
        run.meetingId,
        actor,
        accessToken,
        signal,
      );

      if (signal.aborted) {
        throw new DOMException("Demo playback aborted", "AbortError");
      }

      return run.rooms.connect(
        actor,
        connection.serverUrl,
        connection.participantToken,
        signal,
      );
    },
    [accessToken],
  );

  const playActorAudio = useCallback(
    async (actor: DemoActor, url: string, run: DemoRun) => {
      const signal = run.controller.signal;
      const room = await connectActor(actor, run);

      const audioContext = new AudioContext();
      let cleanupTrack: (() => Promise<void>) | undefined;
      let releaseFloor: (() => Promise<void>) | undefined;
      let pendingFloorRelease: Promise<void> | undefined;
      let source: AudioBufferSourceNode | undefined;

      try {
        await audioContext.resume();

        const audioBuffer = await loadAudioBuffer(audioContext, url, signal);

        if (signal.aborted) {
          throw new DOMException("Demo playback aborted", "AbortError");
        }

        source = audioContext.createBufferSource();
        const playbackSource = source;

        source.buffer = audioBuffer;

        const destination = audioContext.createMediaStreamDestination();

        source.connect(destination);

        const mediaTrack = destination.stream.getAudioTracks()[0];

        if (!mediaTrack) {
          throw new Error("Demo audio track could not be created");
        }

        const localTrack = new LocalAudioTrack(
          mediaTrack,
          undefined,
          false,
          audioContext,
        );

        cleanupTrack = async () => {
          try {
            if (
              room.state === ConnectionState.Connected &&
              room.localParticipant.getTrackPublicationByName(`demo-${actor}`)
                ?.track === localTrack
            ) {
              await room.localParticipant.unpublishTrack(localTrack, false);
            }
          } finally {
            if (mediaTrack.readyState !== "ended") localTrack.stop();
          }
        };
        signal.throwIfAborted();
        if (room.state !== ConnectionState.Connected)
          throw new Error("Demo participant disconnected");
        await room.localParticipant.publishTrack(localTrack, {
          name: `demo-${actor}`,
          source: Track.Source.Microphone,
        });
        signal.throwIfAborted();

        const lease = await acquireFloor(
          {
            send: (type, requestId) => {
              if (room.state !== ConnectionState.Connected) {
                return type === "release"
                  ? Promise.resolve()
                  : Promise.reject(new Error("Demo participant disconnected"));
              }
              const delivery = room.localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify({ type, requestId })),
                { reliable: true, topic: "lumos.floor.v1" },
              );
              // Abort initiates lease release asynchronously. Await that same
              // delivery during media teardown before closing the transport.
              if (type === "release")
                pendingFloorRelease = delivery.catch(() => {});
              return delivery;
            },
            listen: (receive) => {
              const handler = (
                payload: Uint8Array,
                participant: { metadata?: string } | undefined,
                _kind: unknown,
                topic?: string,
              ) => {
                if (topic !== "lumos.floor.v1" || !participant?.metadata)
                  return;
                try {
                  if (JSON.parse(participant.metadata).type !== "lumos-runtime")
                    return;
                  const reply = JSON.parse(
                    new TextDecoder().decode(payload),
                  ) as FloorReply;
                  if (reply.type === "granted" || reply.type === "busy")
                    receive(reply);
                } catch {
                  /* Ignore unrelated or malformed data packets. */
                }
              };
              room.on(RoomEvent.DataReceived, handler);
              return () => {
                room.off(RoomEvent.DataReceived, handler);
              };
            },
          },
          signal,
        );
        releaseFloor = lease.release;
        lease.signal.throwIfAborted();

        if (mountedRef.current) {
          setActiveActor(actor);
          setStatus("playing");
        }

        await new Promise<void>((resolve, reject) => {
          const handleAbort = () => {
            try {
              playbackSource.stop();
            } catch {
              // Source may already
              // be stopped.
            }

            reject(
              lease.signal.reason ??
                new DOMException("Demo playback aborted", "AbortError"),
            );
          };

          lease.signal.addEventListener("abort", handleAbort, {
            once: true,
          });

          playbackSource.onended = () => {
            lease.signal.removeEventListener("abort", handleAbort);

            resolve();
          };
          playbackSource.start();
        });
      } finally {
        if (source) {
          source.onended = null;
          source.disconnect();
        }
        try {
          await cleanupTrack?.();
        } finally {
          try {
            await releaseFloor?.();
            await pendingFloorRelease;
          } finally {
            if (audioContext.state !== "closed") await audioContext.close();
          }
        }
      }
    },
    [connectActor],
  );

  const startDemoParticipants = useCallback(async () => {
    if (runRef.current) {
      return;
    }

    if (!meetingConnected || !meetingId) {
      return;
    }

    if (!accessToken) {
      setError("Authentication is required");

      setStatus("error");

      return;
    }

    const controller = new AbortController();

    const run: DemoRun = {
      meetingId,
      controller,
      rooms: new DemoRoomLifecycle((cause) => controller.abort(cause)),
      task: Promise.resolve(),
    };
    runRef.current = run;

    setError(null);

    setStatus("preparing");

    run.task = (async () => {
      let failure: unknown;
      try {
        /*
         * Give realtime-go and
         * AssemblyAI a moment to
         * fully attach to the room
         * before the first actor
         * starts speaking.
         */
        await wait(1200, controller.signal);

        for (const line of DEMO_SCRIPT) {
          await playActorAudio(line.actor, line.audio, run);

          if (mountedRef.current) setActiveActor(null);

          if (line.delayAfterMs > 0) {
            await wait(line.delayAfterMs, controller.signal);
          }
        }
      } catch (cause) {
        const reason = controller.signal.aborted
          ? controller.signal.reason
          : cause;
        if (!(
          controller.signal.aborted &&
          reason &&
          typeof reason === "object" &&
          "name" in reason &&
          reason.name === "AbortError"
        )) {
          failure = reason;
        }
      } finally {
        try {
          await run.rooms.dispose();
        } catch (cause) {
          failure ??= cause;
        }
        if (runRef.current === run) runRef.current = null;
        if (mountedRef.current) {
          setActiveActor(null);
          setError(
            failure
              ? failure instanceof Error
                ? failure.message
                : "Demo participants failed"
              : null,
          );
          // Do not return to idle on Stop: the connected meeting's auto-start
          // effect would immediately restart playback during meeting ending.
          setStatus(
            failure ? "error" : run.effectCleanup ? "idle" : "finished",
          );
        }
      }
    })();
    await run.task;
  }, [accessToken, meetingConnected, meetingId, playActorAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (runRef.current) {
        runRef.current.effectCleanup = true;
        runRef.current.controller.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!meetingConnected) runRef.current?.controller.abort();
  }, [meetingConnected]);

  useEffect(() => {
    let current = true;
    void stopDemoParticipants().then(() => {
      if (current && mountedRef.current) {
        setStatus("idle");
        setError(null);
      }
    });
    return () => {
      current = false;
    };
  }, [meetingId, stopDemoParticipants]);

  return {
    activeActor,

    status,

    error,

    startDemoParticipants,

    stopDemoParticipants,
  };
}
