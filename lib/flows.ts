import type { FlowStep } from "@/components/Flow";
import { NEIGHBORHOODS } from "./neighborhoods";
import { timeOptions } from "./time";

export function neighborhoodStep(defaultValue = "west-village"): FlowStep {
  return {
    id: "n",
    question: "Where?",
    layout: "grid",
    defaultValue,
    options: NEIGHBORHOODS.map((n) => ({ value: n.id, label: n.name })),
  };
}

export function timeStep(): { step: FlowStep; dow: number } {
  const { options, defaultValue, dow } = timeOptions();
  return {
    dow,
    step: {
      id: "t",
      question: "When?",
      layout: "pills",
      defaultValue: String(defaultValue),
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

export function nightSteps(): { steps: FlowStep[]; dow: number } {
  const { step: t, dow } = timeStep();
  return {
    dow,
    steps: [
      neighborhoodStep(),
      {
        id: "g",
        question: "How many?",
        layout: "numbers",
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
        layout: "numbers",
        defaultValue: "4",
        options: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({ value: String(n), label: n === 11 ? "11+" : String(n) })),
      },
      { ...t, question: "Dinner at?", hint: "ROUND times the bar for after." },
    ],
  };
}
