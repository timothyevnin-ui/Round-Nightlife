import type { AttrKey } from "./attrs";

/**
 * The swipe deck. Each card is a quick, specific question. A "yes" pushes the
 * listed attributes up (or down, for negative weights); a "no" does the reverse
 * at half strength unless `noWants` says otherwise. "either" cards have two
 * sides instead of yes/no.
 *
 * The bank is bigger than any single deck: `pickDeck` chooses a handful based
 * on context (night, group size, time, day) so the questions feel aware of the
 * night, and the rest rotate. Tone: the way a friend who knows the city would
 * actually ask. Nothing anyone has to think twice about answering.
 */

export type Wants = Partial<Record<AttrKey | "noLine" | "new", number>>;

export type DeckMode = "night" | "date" | "dinner";

export type Card = {
  id: string;
  kind: "yesno" | "either";
  prompt: string;
  sub?: string;
  art: { from: string; to: string; angle?: number };
  /** yes/no cards */
  yesWants?: Wants;
  noWants?: Wants;
  /** either cards: swipe left = a, right = b */
  a?: { label: string; wants: Wants };
  b?: { label: string; wants: Wants };
  /** Show only when the context matches. */
  when?: (ctx: DeckContext) => boolean;
  /** Always included when `when` passes (otherwise it's in the rotation). */
  core?: boolean;
  mode: DeckMode[];
};

export type DeckContext = {
  mode: DeckMode;
  group: number;
  hour: number; // 24h, 24+ after midnight
  dow: number; // 0 Sun … 6 Sat
  neighborhood: string;
};

const ART = {
  crimson: { from: "#3a1a2a", to: "#c04a6a", angle: 155 },
  forest: { from: "#0f2a1e", to: "#2f7a5a", angle: 165 },
  brass: { from: "#1c160a", to: "#8a6a2a", angle: 160 },
  navy: { from: "#16213a", to: "#2e4470", angle: 165 },
  plum: { from: "#1c1030", to: "#6a3aa8", angle: 165 },
  sea: { from: "#0e2a3a", to: "#1f7a9a", angle: 175 },
  amber: { from: "#2b1d0c", to: "#b8862a", angle: 170 },
  slate: { from: "#1f2a3a", to: "#4a5a6e", angle: 180 },
  rose: { from: "#3a1a2a", to: "#a8506a", angle: 155 },
  night: { from: "#0f1b17", to: "#1f4a3c", angle: 200 },
  mint: { from: "#0c2a2a", to: "#2a8a7a", angle: 165 },
  ember: { from: "#2a0f0c", to: "#a8402a", angle: 160 },
  tomato: { from: "#7a2412", to: "#e4694a", angle: 160 },
} as const;

const isGameNight = (c: DeckContext) => [0, 1, 4, 6].includes(c.dow); // Sun, Mon, Thu, Sat
const isLate = (c: DeckContext) => c.hour >= 22.5;
const isEarly = (c: DeckContext) => c.hour < 20;
const isWeekend = (c: DeckContext) => [4, 5, 6].includes(c.dow);
const bigGroup = (c: DeckContext) => c.group >= 6;
const beforeMidnight = (c: DeckContext) => c.hour < 24;

export const CARDS: Card[] = [
  /* ────────────────────────── NIGHT OUT · core ────────────────────────── */
  {
    id: "dance",
    kind: "yesno",
    prompt: "Are we dancing?",
    sub: "A DJ, a floor, someone's going to lose a jacket.",
    art: ART.crimson,
    yesWants: { dance: 1, lively: 0.5, talk: -0.5 },
    noWants: { dance: -0.6 },
    core: true,
    mode: ["night"],
  },
  {
    id: "loud",
    kind: "either",
    prompt: "Loud or can-hear-yourself?",
    sub: "Pick the one you'll want at 11, not at 9.",
    art: ART.navy,
    a: { label: "Loud", wants: { lively: 1, talk: -0.6 } },
    b: { label: "Talk", wants: { talk: 1, lively: -0.6 } },
    core: true,
    mode: ["night"],
  },
  {
    id: "seat",
    kind: "either",
    prompt: "Sitting or standing?",
    sub: "A booth with your name on it, or shoulder to shoulder.",
    art: ART.forest,
    a: { label: "Sit", wants: { seating: 1, chill: 0.3 } },
    b: { label: "Stand", wants: { seating: -0.4, lively: 0.3 } },
    core: true,
    mode: ["night"],
  },
  {
    id: "line",
    kind: "yesno",
    prompt: "Would you wait in a line?",
    sub: "Some rooms are worth twenty minutes. Some nights aren't.",
    art: ART.slate,
    yesWants: { noLine: -0.2, scene: 0.3 },
    noWants: { noLine: 1 },
    core: true,
    mode: ["night"],
  },
  {
    id: "table-for-all",
    kind: "yesno",
    prompt: "Room for all of you?",
    sub: "Somewhere that won't flinch when six walk in.",
    art: ART.amber,
    yesWants: { groups: 1, seating: 0.7 },
    noWants: { groups: 0.3 },
    when: bigGroup,
    core: true,
    mode: ["night"],
  },

  /* ────────────────────────── NIGHT OUT · when it fits ────────────────── */
  {
    id: "game",
    kind: "yesno",
    prompt: "Is there a game on?",
    sub: "Screens, sound up, people who care about the score.",
    art: ART.mint,
    yesWants: { sports: 1, seating: 0.3 },
    noWants: { sports: -0.5 },
    when: isGameNight,
    mode: ["night"],
  },
  {
    id: "late",
    kind: "either",
    prompt: "How late are we going?",
    sub: "Be honest about tomorrow.",
    art: ART.night,
    a: { label: "Home by 1", wants: { late: -0.3, chill: 0.3 } },
    b: { label: "Late late", wants: { late: 1, lively: 0.3 } },
    when: isLate,
    mode: ["night"],
  },
  {
    id: "hh",
    kind: "yesno",
    prompt: "Happy hour first?",
    sub: "A real deal before eight, then see where it goes.",
    art: ART.amber,
    yesWants: { happyHour: 1, cheap: 0.4 },
    noWants: {},
    when: isEarly,
    mode: ["night"],
  },
  {
    id: "pregame",
    kind: "either",
    prompt: "Pregame or the main event?",
    sub: "Warming up somewhere cheap, or this is the night.",
    art: ART.ember,
    a: { label: "Pregame", wants: { cheap: 0.8, happyHour: 0.5, dive: 0.3 } },
    b: { label: "Main event", wants: { lively: 0.6, scene: 0.3, late: 0.3 } },
    when: isEarly,
    mode: ["night"],
  },

  /* ────────────────────────── NIGHT OUT · rotation ────────────────────── */
  {
    id: "drink",
    kind: "either",
    prompt: "Cocktails or beers?",
    sub: "Sets the price and the pace.",
    art: ART.plum,
    a: { label: "Cocktails", wants: { cocktails: 1 } },
    b: { label: "Beers", wants: { beer: 1, cheap: 0.3 } },
    mode: ["night"],
  },
  {
    id: "dive-nice",
    kind: "either",
    prompt: "Sticky floors or nice glassware?",
    sub: "Both are correct. Tonight?",
    art: ART.slate,
    a: { label: "Dive", wants: { dive: 1, cheap: 0.5, upscale: -0.6 } },
    b: { label: "Nice", wants: { upscale: 1, dive: -0.6 } },
    mode: ["night"],
  },
  {
    id: "roof-basement",
    kind: "either",
    prompt: "Rooftop or basement?",
    sub: "Skyline, or no windows at all.",
    art: ART.sea,
    a: { label: "Rooftop", wants: { rooftop: 1, outdoor: 0.6 } },
    b: { label: "Basement", wants: { speakeasy: 0.7, late: 0.3, lively: 0.3 } },
    mode: ["night"],
  },
  {
    id: "outside",
    kind: "yesno",
    prompt: "Outside if it's nice?",
    sub: "Backyard, patio, a sidewalk table.",
    art: ART.forest,
    yesWants: { outdoor: 1 },
    noWants: {},
    when: beforeMidnight,
    mode: ["night", "date", "dinner"],
  },
  {
    id: "spend",
    kind: "either",
    prompt: "Spending or saving?",
    sub: "Rent's due, or it's not.",
    art: ART.ember,
    a: { label: "Saving", wants: { cheap: 1, upscale: -0.5 } },
    b: { label: "Spending", wants: { upscale: 0.8, cocktails: 0.3 } },
    mode: ["night"],
  },
  {
    id: "dressed",
    kind: "either",
    prompt: "What are you wearing?",
    sub: "This decides more than you'd think.",
    art: ART.rose,
    a: { label: "Sneakers", wants: { dressy: -0.5, dive: 0.3 } },
    b: { label: "Dressed up", wants: { dressy: 1, upscale: 0.6, dive: -0.5 } },
    mode: ["night", "date"],
  },
  {
    id: "old-ny",
    kind: "either",
    prompt: "Old New York or new New York?",
    sub: "Wood and brass, or the place that opened in March.",
    art: ART.brass,
    a: { label: "Old", wants: { classic: 1 } },
    b: { label: "New", wants: { scene: 0.4, new: 0.5, classic: -0.4 } },
    mode: ["night", "date"],
  },
  {
    id: "meet",
    kind: "yesno",
    prompt: "Trying to meet people?",
    sub: "Somewhere strangers actually talk to each other.",
    art: ART.crimson,
    yesWants: { social: 1, lively: 0.4 },
    noWants: {},
    mode: ["night"],
  },
  {
    id: "food",
    kind: "yesno",
    prompt: "Are we eating there?",
    sub: "Fries at minimum. Possibly a burger.",
    art: ART.amber,
    yesWants: { food: 1 },
    noWants: {},
    mode: ["night"],
  },
  {
    id: "new",
    kind: "yesno",
    prompt: "Somewhere none of you have been?",
    sub: "Skip the usual spots.",
    art: ART.navy,
    yesWants: { new: 1 },
    noWants: {},
    mode: ["night", "date", "dinner"],
  },
  {
    id: "activity",
    kind: "yesno",
    prompt: "Something to do while you drink?",
    sub: "Pool, darts, karaoke, a show.",
    art: ART.mint,
    yesWants: { activity: 1 },
    noWants: {},
    mode: ["night", "date"],
  },
  {
    id: "frozen",
    kind: "yesno",
    prompt: "Frozen drinks?",
    sub: "The machine is calling.",
    art: ART.sea,
    yesWants: { frozen: 1, lively: 0.3 },
    noWants: {},
    when: (c) => isWeekend(c) || c.hour < 21,
    mode: ["night"],
  },
  {
    id: "scene",
    kind: "either",
    prompt: "A scene or under the radar?",
    sub: "Doorman and a wait, or a corner nobody's posting.",
    art: ART.plum,
    a: { label: "Under the radar", wants: { scene: -0.8, classic: 0.2 } },
    b: { label: "A scene", wants: { scene: 1, dressy: 0.4 } },
    mode: ["night"],
  },
  {
    id: "birthday",
    kind: "yesno",
    prompt: "Is it someone's birthday?",
    sub: "Then it needs to feel like it.",
    art: ART.tomato,
    yesWants: { lively: 0.7, groups: 0.7, activity: 0.3 },
    noWants: {},
    when: (c) => c.group >= 4,
    mode: ["night"],
  },
  {
    id: "live",
    kind: "yesno",
    prompt: "Live music?",
    sub: "A band, a piano, someone with a guitar.",
    art: ART.brass,
    yesWants: { liveMusic: 1 },
    noWants: { liveMusic: -0.3 },
    mode: ["night", "date"],
  },
  {
    id: "parents",
    kind: "yesno",
    prompt: "Would your parents like it?",
    sub: "Classy, comfortable, nobody yelling.",
    art: ART.brass,
    yesWants: { classic: 0.6, talk: 0.6, upscale: 0.4, dive: -0.5 },
    noWants: {},
    mode: ["night"],
  },

  /* ────────────────────────── DATE ────────────────────────────────────── */
  {
    id: "d-hear",
    kind: "yesno",
    prompt: "Need to hear each other?",
    sub: "First-date volume.",
    art: ART.brass,
    yesWants: { talk: 1, lively: -0.5 },
    noWants: { lively: 0.5 },
    core: true,
    mode: ["date"],
  },
  {
    id: "d-light",
    kind: "yesno",
    prompt: "Low light?",
    sub: "Candles, corners, a little flattering.",
    art: ART.night,
    yesWants: { date: 1, cocktails: 0.4 },
    noWants: {},
    core: true,
    mode: ["date"],
  },
  {
    id: "d-impress",
    kind: "either",
    prompt: "Impress or relax?",
    sub: "Both work. Pick tonight's.",
    art: ART.rose,
    a: { label: "Impress", wants: { upscale: 1, dressy: 0.6, cocktails: 0.4 } },
    b: { label: "Relax", wants: { chill: 1, dive: 0.3, cheap: 0.3 } },
    core: true,
    mode: ["date"],
  },
  {
    id: "d-do",
    kind: "yesno",
    prompt: "Something to do together?",
    sub: "Pool, a show, an excuse to move.",
    art: ART.mint,
    yesWants: { activity: 1, lively: 0.3 },
    noWants: {},
    mode: ["date"],
  },
  {
    id: "d-exit",
    kind: "either",
    prompt: "One drink or the whole night?",
    sub: "Easy to leave, or easy to stay.",
    art: ART.slate,
    a: { label: "One drink", wants: { chill: 0.4, seating: 0.4, late: -0.3 } },
    b: { label: "Whole night", wants: { date: 0.5, late: 0.4, food: 0.3 } },
    mode: ["date"],
  },
  {
    id: "d-cheap",
    kind: "yesno",
    prompt: "Cheap and charming?",
    sub: "Good, not grand.",
    art: ART.ember,
    yesWants: { cheap: 0.8, classic: 0.4 },
    noWants: {},
    mode: ["date"],
  },
  {
    id: "d-wine",
    kind: "either",
    prompt: "Wine or cocktails?",
    sub: "Sets the whole tone.",
    art: ART.plum,
    a: { label: "Wine", wants: { wine: 1 } },
    b: { label: "Cocktails", wants: { cocktails: 1 } },
    mode: ["date"],
  },
  {
    id: "d-buzz",
    kind: "either",
    prompt: "Buzzy or hidden?",
    sub: "A room with a hum, or a room nobody knows.",
    art: ART.sea,
    a: { label: "Buzzy", wants: { lively: 0.6, scene: 0.4 } },
    b: { label: "Hidden", wants: { speakeasy: 0.8, talk: 0.4 } },
    mode: ["date"],
  },

  /* ────────────────────────── DINNER & DRINKS (groups) ────────────────── */
  {
    id: "g-share",
    kind: "either",
    prompt: "Sharing plates or everyone orders?",
    sub: "Family style makes a group a group.",
    art: ART.amber,
    a: { label: "Share", wants: { groups: 0.8, lively: 0.4 } },
    b: { label: "Own plate", wants: { seating: 0.5, classic: 0.3 } },
    core: true,
    mode: ["dinner"],
  },
  {
    id: "g-loud",
    kind: "either",
    prompt: "Loud and fun, or nice and calm?",
    sub: "For dinner. Drinks can go either way after.",
    art: ART.tomato,
    a: { label: "Loud & fun", wants: { lively: 0.9, talk: -0.3 } },
    b: { label: "Nice & calm", wants: { talk: 0.9, upscale: 0.4 } },
    core: true,
    mode: ["dinner"],
  },
  {
    id: "g-spend",
    kind: "either",
    prompt: "Splurge or split the check easy?",
    sub: "Someone always asks.",
    art: ART.ember,
    a: { label: "Easy check", wants: { cheap: 0.9, upscale: -0.5 } },
    b: { label: "Splurge", wants: { upscale: 0.9, cocktails: 0.3 } },
    core: true,
    mode: ["dinner"],
  },
  {
    id: "g-after",
    kind: "either",
    prompt: "After dinner: dancing or a nightcap?",
    sub: "This picks the bar.",
    art: ART.crimson,
    a: { label: "Nightcap", wants: { chill: 0.7, cocktails: 0.5, talk: 0.4 } },
    b: { label: "Dancing", wants: { dance: 1, lively: 0.6, late: 0.4 } },
    core: true,
    mode: ["dinner"],
  },
  {
    id: "g-book",
    kind: "yesno",
    prompt: "Need somewhere you can book?",
    sub: "Big groups and walk-ins don't mix on a Saturday.",
    art: ART.slate,
    yesWants: { groups: 0.8, seating: 0.6 },
    noWants: { noLine: 0.5 },
    when: bigGroup,
    mode: ["dinner"],
  },
  {
    id: "g-dressed",
    kind: "either",
    prompt: "Dressed up or came as you are?",
    sub: "It changes the room.",
    art: ART.rose,
    a: { label: "As you are", wants: { dressy: -0.5, chill: 0.3 } },
    b: { label: "Dressed up", wants: { dressy: 0.9, upscale: 0.5 } },
    mode: ["dinner"],
  },
  {
    id: "g-classic",
    kind: "either",
    prompt: "A classic or something new?",
    sub: "Red sauce and white tablecloths, or the spot everyone's posting.",
    art: ART.brass,
    a: { label: "Classic", wants: { classic: 1 } },
    b: { label: "New", wants: { scene: 0.5, new: 0.5 } },
    mode: ["dinner"],
  },
];

/** Pick a deck: core cards that fit the context, then rotate the rest. */
export function pickDeck(ctx: DeckContext, size = 6, seed = Date.now()): Card[] {
  const eligible = CARDS.filter((c) => c.mode.includes(ctx.mode) && (!c.when || c.when(ctx)));
  const core = eligible.filter((c) => c.core);
  const rest = eligible.filter((c) => !c.core);
  // Deterministic shuffle so a refresh doesn't reshuffle mid-deck.
  let s = seed % 2147483647;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const shuffled = [...rest].sort(() => rnd() - 0.5);
  return [...core, ...shuffled].slice(0, size);
}

/** Merge a card answer into the running wants. */
export function applyAnswer(wants: Wants, card: Card, answer: "yes" | "no" | "a" | "b" | "skip"): Wants {
  const delta: Wants =
    answer === "skip"
      ? {}
      : card.kind === "yesno"
        ? answer === "yes"
          ? card.yesWants ?? {}
          : card.noWants ?? {}
        : answer === "a"
          ? card.a?.wants ?? {}
          : card.b?.wants ?? {};
  const next: Wants = { ...wants };
  for (const [k, v] of Object.entries(delta) as [keyof Wants, number][]) {
    next[k] = Math.max(-1, Math.min(1, (next[k] ?? 0) + v));
  }
  return next;
}

/** Wants ⇄ URL param: "dance:1,seating:1,noLine:1,lively:-0.6" */
export function encodeWants(w: Wants): string {
  return Object.entries(w)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([k, v]) => `${k}:${Number(v!.toFixed(2))}`)
    .join(",");
}

export function decodeWants(s: string | undefined | null): Wants {
  const out: Wants = {};
  if (!s) return out;
  for (const part of s.split(",")) {
    const [k, v] = part.split(":");
    const n = Number(v);
    if (k && Number.isFinite(n)) out[k as keyof Wants] = Math.max(-1, Math.min(1, n));
  }
  return out;
}

/** Human labels for the results header. */
export function describeWants(w: Wants): string[] {
  const labels: Partial<Record<keyof Wants, [string, string]>> = {
    dance: ["Dancing", "No dancing"],
    seating: ["Sit down", "Standing's fine"],
    lively: ["Loud", "Not loud"],
    talk: ["Can talk", "Don't need to talk"],
    chill: ["Chill", "Not chill"],
    noLine: ["No line", "Line's fine"],
    groups: ["Big group", ""],
    sports: ["The game", "No game"],
    late: ["Late", "Early night"],
    happyHour: ["Happy hour", ""],
    liveMusic: ["Live music", "No live music"],
    cocktails: ["Cocktails", ""],
    beer: ["Beers", ""],
    wine: ["Wine", ""],
    dive: ["Dive", "No dive"],
    upscale: ["Nice", "Not fancy"],
    rooftop: ["Rooftop", ""],
    speakeasy: ["Hidden", ""],
    outdoor: ["Outside", ""],
    cheap: ["Cheap", ""],
    dressy: ["Dressed up", "Sneakers"],
    classic: ["Old New York", "Something new"],
    social: ["Meet people", ""],
    food: ["Food", ""],
    new: ["Somewhere new", ""],
    activity: ["Something to do", ""],
    frozen: ["Frozen drinks", ""],
    scene: ["A scene", "Under the radar"],
    date: ["Low light", ""],
  };
  return Object.entries(w)
    .filter(([, v]) => typeof v === "number" && Math.abs(v) >= 0.5)
    .map(([k, v]) => {
      const l = labels[k as keyof Wants];
      if (!l) return "";
      return v! > 0 ? l[0] : l[1];
    })
    .filter(Boolean)
    .slice(0, 6);
}
