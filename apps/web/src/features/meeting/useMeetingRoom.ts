'use client';

import {
  ConnectionState,
  Room,
  RoomEvent,
} from 'livekit-client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getLiveKitConnectionDetails } from '@/lib/livekit';
import {
  createMeeting,
  endMeeting,
} from '@/lib/meetings';

type MeetingStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

interface UseMeetingRoomResult {
  status: MeetingStatus;

  meetingId: string | null;
  roomName: string | null;

  error: string | null;

  startMeeting: () => Promise<void>;
  stopMeeting: () => Promise<void>;
}

export function useMeetingRoom(): UseMeetingRoomResult {
  const roomRef =
    useRef<Room | null>(null);

  const meetingIdRef =
    useRef<string | null>(null);

  const startAbortRef =
    useRef<AbortController | null>(null);

  const [status, setStatus] =
    useState<MeetingStatus>('idle');

  const [meetingId, setMeetingId] =
    useState<string | null>(null);

  const [roomName, setRoomName] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const clearMeetingState =
    useCallback(() => {
      meetingIdRef.current = null;

      setMeetingId(null);
      setRoomName(null);
    }, []);

  const releaseRuntimeIdentity =
    useCallback(() => {
      meetingIdRef.current = null;

      // Keep meetingId in React state.
      //
      // The snapshot UI uses it to show the
      // final meeting outcome after Stop.
      setRoomName(null);
    }, []);

  const stopMeeting =
    useCallback(async () => {
      startAbortRef.current?.abort();
      startAbortRef.current = null;

      const room =
        roomRef.current;

      const currentMeetingId =
        meetingIdRef.current;

      if (
        !room &&
        !currentMeetingId
      ) {
        setStatus('idle');

        return;
      }

      setError(null);
      setStatus('disconnecting');

      let disconnectError:
        unknown = null;

      let lifecycleError:
        unknown = null;

      if (room) {
        try {
          await room.localParticipant
            .setMicrophoneEnabled(false);

          await room.disconnect();
        } catch (cause) {
          disconnectError = cause;
        } finally {
          if (
            roomRef.current === room
          ) {
            roomRef.current = null;
          }
        }
      }

      if (currentMeetingId) {
        try {
          await endMeeting(
            currentMeetingId,
          );

          // Lifecycle ended successfully.
          //
          // Release runtime identity but retain
          // meetingId for the final snapshot.
          releaseRuntimeIdentity();
        } catch (cause) {
          lifecycleError = cause;
        }
      }

      const cause =
        lifecycleError ??
        disconnectError;

      if (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Failed to stop meeting cleanly';

        setError(message);
        setStatus('error');

        return;
      }

      setStatus('idle');
    }, [
      releaseRuntimeIdentity,
    ]);

  const startMeeting =
    useCallback(async () => {
      if (
        roomRef.current ||
        startAbortRef.current ||
        meetingIdRef.current
      ) {
        return;
      }

      const abortController =
        new AbortController();

      startAbortRef.current =
        abortController;

      setError(null);

      // Starting a new meeting intentionally
      // replaces the previous final snapshot.
      clearMeetingState();

      setStatus('connecting');

      let room:
        Room |
        null = null;

      let createdMeetingId:
        string |
        null = null;

      try {
        const meeting =
          await createMeeting(
            abortController.signal,
          );

        createdMeetingId =
          meeting.meetingId;

        if (
          abortController.signal.aborted
        ) {
          return;
        }

        meetingIdRef.current =
          meeting.meetingId;

        setMeetingId(
          meeting.meetingId,
        );

        setRoomName(
          meeting.roomName,
        );

        const connection =
          await getLiveKitConnectionDetails(
            meeting.meetingId,
            abortController.signal,
          );

        if (
          abortController.signal.aborted
        ) {
          return;
        }

        if (
          connection.meetingId !==
          meeting.meetingId
        ) {
          throw new Error(
            'LiveKit meeting identity mismatch',
          );
        }

        if (
          connection.roomName !==
          meeting.roomName
        ) {
          throw new Error(
            'LiveKit room identity mismatch',
          );
        }

        room =
          new Room({
            adaptiveStream:
              true,

            dynacast:
              true,
          });

        roomRef.current =
          room;

        room.on(
          RoomEvent.Disconnected,
          () => {
            if (
              roomRef.current !==
              room
            ) {
              return;
            }

            roomRef.current =
              null;

            // Transport disconnect is not the
            // same thing as meeting.end.
            setStatus('idle');
          },
        );

        room.on(
          RoomEvent.ConnectionStateChanged,
          (
            connectionState,
          ) => {
            if (
              connectionState ===
              ConnectionState.Connected
            ) {
              setStatus(
                'connected',
              );
            }
          },
        );

        await room.connect(
          connection.serverUrl,
          connection.participantToken,
        );

        if (
          abortController.signal.aborted
        ) {
          await room.disconnect();

          if (
            roomRef.current ===
            room
          ) {
            roomRef.current =
              null;
          }

          return;
        }

        await room.localParticipant
          .setMicrophoneEnabled(
            true,
          );

        setStatus(
          'connected',
        );
      } catch (cause) {
        if (room) {
          try {
            await room.disconnect();
          } finally {
            if (
              roomRef.current ===
              room
            ) {
              roomRef.current =
                null;
            }
          }
        }

        if (
          createdMeetingId &&
          !abortController
            .signal
            .aborted
        ) {
          try {
            await endMeeting(
              createdMeetingId,
            );
          } catch {
            // Preserve original Start error.
          }
        }

        clearMeetingState();

        if (
          abortController.signal.aborted
        ) {
          setStatus('idle');

          return;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : 'Failed to connect to meeting';

        setError(message);
        setStatus('error');
      } finally {
        if (
          startAbortRef.current ===
          abortController
        ) {
          startAbortRef.current =
            null;
        }
      }
    }, [
      clearMeetingState,
    ]);

  useEffect(() => {
    return () => {
      startAbortRef.current
        ?.abort();

      startAbortRef.current =
        null;

      const room =
        roomRef.current;

      if (room) {
        void room.disconnect();

        roomRef.current =
          null;
      }
    };
  }, []);

  return {
    status,

    meetingId,
    roomName,

    error,

    startMeeting,
    stopMeeting,
  };
}
