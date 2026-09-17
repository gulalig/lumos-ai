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

type MeetingStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

interface UseMeetingRoomResult {
  status: MeetingStatus;
  error: string | null;
  startMeeting: () => Promise<void>;
  stopMeeting: () => Promise<void>;
}

export function useMeetingRoom(): UseMeetingRoomResult {
  const roomRef = useRef<Room | null>(null);

  const [status, setStatus] = useState<MeetingStatus>('idle');

  const [error, setError] = useState<string | null>(null);

  const stopMeeting = useCallback(async () => {
    const room = roomRef.current;

    if (!room) {
      setStatus('idle');
      return;
    }

    setStatus('disconnecting');

    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
    } finally {
      roomRef.current = null;
      setStatus('idle');
    }
  }, []);

  const startMeeting = useCallback(async () => {
    if (roomRef.current) {
      return;
    }

    setError(null);
    setStatus('connecting');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    roomRef.current = room;

    room.on(RoomEvent.Disconnected, () => {
      roomRef.current = null;
      setStatus('idle');
    });

    room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
      if (connectionState === ConnectionState.Connected) {
        setStatus('connected');
      }
    });

    try {
      const connection = await getLiveKitConnectionDetails();

      await room.connect(
        connection.serverUrl,
        connection.participantToken,
      );

      await room.localParticipant.setMicrophoneEnabled(
        true,
      );

      setStatus('connected');
    } catch (cause) {
      await room.disconnect();
      roomRef.current = null;

      const message = cause instanceof Error ? cause.message : 'Failed to connect to meeting';

      setError(message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    return () => {
      const room = roomRef.current;

      if (room) {
        void room.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    status,
    error,
    startMeeting,
    stopMeeting,
  };
}
