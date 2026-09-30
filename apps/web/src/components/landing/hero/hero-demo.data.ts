export interface HeroTranscriptMessage {
  speaker: string;
  initials: string;
  text: string;
}

export const HERO_TRANSCRIPT = {
  release: {
    speaker: "Alex",
    initials: "AL",
    text: "Let's ship the onboarding update on Friday.",
  },

  task: {
    speaker: "Maya",
    initials: "MA",
    text: "I'll fix the auth redirect before release.",
  },

  api: {
    speaker: "Daniel",
    initials: "DA",
    text: "The API changes are already merged.",
  },

  review: {
    speaker: "Sophie",
    initials: "SO",
    text: "I can review the pricing page today.",
  },

  answer: {
    speaker: "Alex",
    initials: "AL",
    text: "Let's have the auth redirect done by Thursday afternoon.",
  },
} satisfies Record<string, HeroTranscriptMessage>;
