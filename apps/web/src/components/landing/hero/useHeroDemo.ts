"use client";

import { useEffect, useState } from "react";

interface DemoStep {
  step: number;
  duration: number;
}

const DEMO_TIMELINE: DemoStep[] = [
  {
    step: 1,
    duration: 1600,
  },
  {
    step: 2,
    duration: 1600,
  },
  {
    step: 3,
    duration: 1500,
  },
  {
    step: 4,
    duration: 1500,
  },
  {
    step: 5,
    duration: 1600,
  },
  {
    step: 6,
    duration: 1700,
  },
  {
    step: 7,
    duration: 2100,
  },
  {
    step: 8,
    duration: 2500,
  },
  {
    step: 9,
    duration: 1800,
  },
  {
    step: 10,
    duration: 1800,
  },
  {
    step: 11,
    duration: 2200,
  },
];

export function useHeroDemo() {
  const [timelineIndex, setTimelineIndex] = useState(0);

  const step = DEMO_TIMELINE[timelineIndex]?.step ?? 1;

  useEffect(() => {
    const current = DEMO_TIMELINE[timelineIndex];

    if (!current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setTimelineIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= DEMO_TIMELINE.length) {
          return 0;
        }

        return nextIndex;
      });
    }, current.duration);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [timelineIndex]);

  return {
    step,

    showReleaseTranscript: step >= 1,

    showDecision: step >= 2,

    showTaskTranscript: step >= 3,

    showApiTranscript: step >= 4,

    showReviewTranscript: step >= 5,

    showAction: step >= 6,

    showMissingDue: step >= 7,

    lumosSpeaking: step >= 8,

    showAnswer: step >= 9,

    showResolved: step >= 10,

    showJira: step >= 11,
  };
}
