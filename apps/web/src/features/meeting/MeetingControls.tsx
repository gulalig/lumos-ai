'use client';

import type { FC } from 'react';

import { useMeetingRoom } from './useMeetingRoom';

export const MeetingControls: FC = () => {
  const {
    status,
    error,
    startMeeting,
    stopMeeting,
  } = useMeetingRoom();

  const isConnected = status === 'connected';
  const isBusy = status === 'connecting' || status === 'disconnecting';

  return (
    <section>
      <h1>LUMOS Meeting</h1>

      <p>Status: {status}</p>

      {error ? (
        <p role="alert">
          {error}
        </p>
      ) : null}

      {!isConnected ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void startMeeting()}
        >
          {status === 'connecting' ? 'Connecting...' : 'Start meeting'}
        </button>
      ) : (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void stopMeeting()}
        >
          End meeting
        </button>
      )}
    </section>
  );
};
