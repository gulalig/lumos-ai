'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  getMeetingSnapshot,
} from '@/lib/meeting-snapshot';

import type {
  MeetingSnapshot,
} from '@/lib/meeting-snapshot';

const POLL_INTERVAL_MS = 1_000;

interface UseMeetingSnapshotResult {
  snapshot: MeetingSnapshot | null;

  isLoading: boolean;

  error: string | null;
}

interface SnapshotState {
  meetingId: string;

  snapshot: MeetingSnapshot | null;

  error: string | null;
}

export function useMeetingSnapshot(
  meetingId: string | null,
): UseMeetingSnapshotResult {
  const [
    state,
    setState,
  ] = useState<SnapshotState | null>(
    null,
  );

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    let disposed = false;

    let timeoutId:
      ReturnType<typeof setTimeout> |
      null = null;

    let activeController:
      AbortController |
      null = null;

    const poll =
      async (): Promise<void> => {
        const controller =
          new AbortController();

        activeController =
          controller;

        try {
          const snapshot =
            await getMeetingSnapshot(
              meetingId,
              controller.signal,
            );

          if (
            disposed ||
            controller.signal.aborted
          ) {
            return;
          }

          setState({
            meetingId,
            snapshot,
            error: null,
          });

          // Ended meeting snapshot is immutable.
          // No reason to continue polling.
          if (
            snapshot.status ===
            'ended'
          ) {
            return;
          }
        } catch (cause) {
          if (
            disposed ||
            controller.signal.aborted
          ) {
            return;
          }

          const message =
            cause instanceof Error
              ? cause.message
              : 'Failed to load meeting snapshot';

          setState({
            meetingId,
            snapshot: null,
            error: message,
          });
        } finally {
          if (
            activeController ===
            controller
          ) {
            activeController =
              null;
          }
        }

        if (!disposed) {
          timeoutId =
            setTimeout(
              () => {
                void poll();
              },
              POLL_INTERVAL_MS,
            );
        }
      };

    void poll();

    return () => {
      disposed = true;

      if (timeoutId) {
        clearTimeout(
          timeoutId,
        );
      }

      activeController?.abort();
    };
  }, [
    meetingId,
  ]);

  // No selected meeting.
  if (!meetingId) {
    return {
      snapshot: null,
      isLoading: false,
      error: null,
    };
  }

  // A new meeting ID was selected, but its first
  // snapshot has not arrived yet.
  //
  // Do not render the previous meeting snapshot.
  if (
    !state ||
    state.meetingId !== meetingId
  ) {
    return {
      snapshot: null,
      isLoading: true,
      error: null,
    };
  }

  return {
    snapshot:
    state.snapshot,

    isLoading:
      false,

    error:
    state.error,
  };
}
