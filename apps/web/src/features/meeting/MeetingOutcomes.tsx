"use client";

import type { FC } from "react";

import type {
  MeetingSnapshot,
  MeetingSnapshotItem,
} from "@/lib/meeting-snapshot";

interface MeetingOutcomesProps {
  snapshot: MeetingSnapshot | null;

  isLoading: boolean;

  error: string | null;
}

interface OutcomeSectionProps {
  title: string;

  items: MeetingSnapshotItem[];

  emptyText: string;
}

const OutcomeSection: FC<OutcomeSectionProps> = ({
  title,
  items,
  emptyText,
}) => {
  return (
    <section
      className="
        rounded-2xl
        border
        border-zinc-200
        bg-white
        p-5
        shadow-sm
      "
    >
      <div
        className="
          mb-4
          flex
          items-center
          justify-between
          gap-3
        "
      >
        <h2
          className="
            text-base
            font-semibold
            text-zinc-950
          "
        >
          {title}
        </h2>

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
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p
          className="
            text-sm
            text-zinc-500
          "
        >
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="
                  rounded-xl
                  border
                  border-zinc-100
                  bg-zinc-50
                  p-4
                "
            >
              <p
                className="
                    text-sm
                    font-medium
                    leading-6
                    text-zinc-900
                  "
              >
                {item.summary}
              </p>

              {item.owner || item.dueText ? (
                <div
                  className="
                      mt-2
                      flex
                      flex-wrap
                      gap-2
                      text-xs
                      text-zinc-600
                    "
                >
                  {item.owner ? (
                    <span>
                      Owner: <strong>{item.owner}</strong>
                    </span>
                  ) : null}

                  {item.dueText ? (
                    <span>
                      Due: <strong>{item.dueText}</strong>
                    </span>
                  ) : null}
                </div>
              ) : null}

              <details
                className="
                    mt-3
                    text-xs
                    text-zinc-500
                  "
              >
                <summary
                  className="
                      cursor-pointer
                      select-none
                    "
                >
                  Evidence
                </summary>

                <p
                  className="
                      mt-2
                      leading-5
                    "
                >
                  {item.evidenceText}
                </p>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export const MeetingOutcomes: FC<MeetingOutcomesProps> = ({
  snapshot,
  isLoading,
  error,
}) => {
  if (isLoading && !snapshot) {
    return (
      <section
        className="
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-6
          text-sm
          text-zinc-500
          shadow-sm
        "
      >
        Loading meeting outcomes...
      </section>
    );
  }

  if (!snapshot && !error) {
    return (
      <section
        className="
          rounded-2xl
          border
          border-dashed
          border-zinc-300
          bg-white
          p-8
          text-center
        "
      >
        <p
          className="
            text-sm
            text-zinc-500
          "
        >
          Start a meeting to see decisions, commitments, proposals and
          questions.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="
            rounded-xl
            border
            border-red-200
            bg-red-50
            p-3
            text-sm
            text-red-700
          "
        >
          Snapshot error: {error}
        </p>
      ) : null}

      {snapshot ? (
        <>
          <div
            className="
              flex
              flex-wrap
              items-center
              justify-between
              gap-2
              text-xs
              text-zinc-500
            "
          >
            <span>Snapshot version {snapshot.version}</span>

            <span
              className="
                rounded-full
                bg-zinc-100
                px-2.5
                py-1
                font-medium
              "
            >
              {snapshot.status}
            </span>
          </div>

          <div
            className="
              grid
              gap-4
              lg:grid-cols-2
            "
          >
            <OutcomeSection
              title="Decisions"
              items={snapshot.decisions}
              emptyText="No decisions yet."
            />

            <OutcomeSection
              title="Commitments"
              items={snapshot.commitments}
              emptyText="No commitments yet."
            />

            <OutcomeSection
              title="Proposals"
              items={snapshot.proposals}
              emptyText="No proposals yet."
            />

            <OutcomeSection
              title="Open Questions"
              items={snapshot.questions}
              emptyText="No open questions yet."
            />
          </div>
        </>
      ) : null}
    </div>
  );
};
