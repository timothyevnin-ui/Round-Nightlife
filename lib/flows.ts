import type { FlowStep } from "@/components/Flow";
import { NEIGHBORHOODS } from "./neighborhoods";
import { timeOptions } from "./time";
import { dayWhen, nightWhen, nowWhen } from "./when";

export function neighborhoodStep(defaultValue = "west-village"): FlowStep {
  return {
    id: "n",
    question: "Where?",
    layout: "map",
    defaultValue,
    options: NEIGHBORHOODS.map((n) => ({ value: n.id, label: n.name })),
  };
}

/**
 * The "When?" step starts from the chip on Home: the planned time if the
 * person set one, otherwise the phone's clock right now (11am at the
 * earliest, 3am at the latest). They can still move it here.
 */
export function timeStep(kind: "night" | "day" = "night"): { step: FlowStep; dow: number } {
  const { options } = timeOptions();
  const w = kind === "day" ? dayWhen() : nightWhen();
  const now = Math.max(11, Math.min(27, nowWhen().hour));
  const start = Math.max(11, Math.min(27, w.hour));
  return {
    dow: w.dow,
    step: {
      id: "t",
      question: "When?",
      layout: "dial",
      defaultValue: String(start),
      nowValue: now,
      options: options.map((o) => ({ value: String(o.value), label: o.label })),
    },
  };
}

export const VIBE_ART = {
  lively: { from: "#3a1a2a", to: "#c04a6a", angle: 155 },
  chill: { from: "#0f2a1e", to: "#2f7a5a", angle: 165 },
  talk: { from: "#1c160a", to: "#8a6a2a", angle: 160 },
  lowlit: { from: "#16213a", to: "#2e4470", angle: 165 },
} as const;

export function nightSteps(kind: "night" | "day" = "night"): { steps: FlowStep[]; dow: number } {
  const { step: t, dow } = timeStep(kind);
  return {
    dow,
    steps: [
      neighborhoodStep(),
      {
        id: "g",
        question: "How many of you?",
        layout: "wheel",
        defaultValue: "4",
        options: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({ value: String(n), label: n === 11 ? "11+" : String(n) })),
      },
      t,
    ],
  };
}

export function dateSteps(): { steps: FlowStep[]; dow: number } {
  const { step: t, dow } = timeStep();
  return {
    dow,
    steps: [
      neighborhoodStep(),
      {
        id: "s",
        question: "What kind of date?",
        layout: "list",
        defaultValue: "early",
        options: [
          { value: "first", label: "First date", sub: "Easy to stay, easy to leave" },
          { value: "early", label: "A few dates in", sub: "You already know they're fun" },
          { value: "longterm", label: "Long-term", sub: "Make it an occasion" },
        ],
      },
      {
        id: "dn",
        question: "Dinner too?",
        layout: "list",
        defaultValue: "1",
        options: [
          { value: "1", label: "Dinner, then drinks", sub: "ROUND plans the whole evening" },
          { value: "0", label: "Just drinks", sub: "The right bar, nothing else" },
        ],
      },
      { ...t, hint: "Dinner time, if there's dinner. We'll time the rest." },
    ],
  };
}

/** Dinner and drinks for a group: where, how many, when. The deck does the rest. */
export function dinnerSteps(): { steps: FlowStep[]; dow: number } {
  const { step: t, dow } = timeStep();
  return {
    dow,
    steps: [
      neighborhoodStep(),
      {
        id: "g",
        question: "How many for dinner?",
        layout: "wheel",
        defaultValue: "4",
        options: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({ value: String(n), label: n === 11 ? "11+" : String(n) })),
      },
      { ...t, question: "Dinner at?", hint: "ROUND times the bar for after." },
    ],
  };
}
