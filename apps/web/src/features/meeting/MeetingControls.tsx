'use client';

import type {
  FC,
} from 'react';

import { MeetingOutcomes } from './MeetingOutcomes';
import { useMeetingRoom } from './useMeetingRoom';
import { useMeetingSnapshot } from './useMeetingSnapshot';

export const MeetingControls: FC = () => {
  const {
    status,

    meetingId,

    error,

    startMeeting,
    stopMeeting,
  } = useMeetingRoom();

  const {
    snapshot,
    isLoading:
      snapshotLoading,
    error:
      snapshotError,
  } = useMeetingSnapshot(
    meetingId,
  );

  const isConnected =
    status === 'connected';

  const isBusy =
    status === 'connecting' ||
    status === 'disconnecting';

  const showEndButton =
    isConnected ||
    status === 'disconnecting' ||
    (
      status === 'error' &&
      meetingId !== null
    );

  return (
    <section
      className="
        mx-auto
        w-full
        max-w-6xl
        space-y-6
      "
    >
      <div
        className="
          rounded-3xl
          border
          border-zinc-200
          bg-white
          p-6
          shadow-sm
          sm:p-8
        "
      >
        <div
          className="
            flex
            flex-col
            gap-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                mb-2
                flex
                items-center
                gap-2
              "
            >
              <h1
                className="
                  text-2xl
                  font-semibold
                  tracking-tight
                  text-zinc-950
                "
              >
                LUMOS Meeting
              </h1>

              <span
                className="
                  rounded-full
                  bg-zinc-100
                  px-2.5
                  py-1
                  text-xs
                  font-medium
                  text-zinc-600
                "
              >
                {status}
              </span>
            </div>

            <p
              className="
                text-sm
                text-zinc-500
              "
            >
              Conversation to
              coordinated action.
            </p>

            {meetingId ? (
              <p
                className="
                  mt-3
                  break-all
                  font-mono
                  text-xs
                  text-zinc-400
                "
              >
                {meetingId}
              </p>
            ) : null}
          </div>

          <div>
            {showEndButton ? (
              <button
                type="button"
                disabled={
                  isBusy
                }
                onClick={() =>
                  void stopMeeting()
                }
                className="
                  rounded-xl
                  bg-red-600
                  px-5
                  py-3
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-red-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {status ===
                'disconnecting'
                  ? 'Ending...'
                  : 'End meeting'}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  isBusy
                }
                onClick={() =>
                  void startMeeting()
                }
                className="
                  rounded-xl
                  bg-zinc-950
                  px-5
                  py-3
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-zinc-800
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {status ===
                'connecting'
                  ? 'Connecting...'
                  : 'Start meeting'}
              </button>
            )}
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="
              mt-5
              rounded-xl
              border
              border-red-200
              bg-red-50
              p-3
              text-sm
              text-red-700
            "
          >
            {error}
          </p>
        ) : null}
      </div>

      <MeetingOutcomes
        snapshot={snapshot}
        isLoading={
          snapshotLoading
        }
        error={
          snapshotError
        }
      />
    </section>
  );
};
