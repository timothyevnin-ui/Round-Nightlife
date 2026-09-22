import type { AttrKey } from "./attrs";

/**
 * The swipe deck. Each card is a quick, specific question. A "yes" pushes the
 * listed attributes up (or down, for negative weights); a "no" does the reverse
 * at half strength unless `noWants` says otherwise. "either" cards have two
 * sides instead of yes/no.
 *
 * The bank is bigger than any single deck: `pickDeck` chooses a handful based
 * on context so the questions feel aware of the night, and the rest rotate.
 */

export type Wants = Partial<Record<AttrKey | "noLine" | "new", number>>;

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
  mode: ("night" | "date")[];
};

export type DeckContext = {
  mode: "night" | "date";
  group: number;
  hour: number; // 24h, 24+ after midnight
  dow: number; // 0 Sun … 6 Sat
  neighborhood: string;
};

const ART = {
  crimson: { from: "#3a1a2a", to: "#c04a6a", angle: 155 },
  forest: { from: "#0f2a1e", to: "#2f7a5a", angle: 165 },
  brass: { from: "#1c160a", to: "#8a6a2a", angle: 160 },
  cobalt: { from: "#0f1a5c", to: "#2b4dff", angle: 165 },
  plum: { from: "#1c1030", to: "#6a3aa8", angle: 165 },
  sea: { from: "#0e2a3a", to: "#1f7a9a", angle: 175 },
  amber: { from: "#2b1d0c", to: "#b8862a", angle: 170 },
  slate: { from: "#161922", to: "#4a5160", angle: 180 },
  rose: { from: "#3a1a2a", to: "#a8506a", angle: 155 },
  night: { from: "#0b0c10", to: "#1d37c4", angle: 200 },
  mint: { from: "#0c2a2a", to: "#2a8a7a", angle: 165 },
  ember: { from: "#2a0f0c", to: "#a8402a", angle: 160 },
} as const;

const isGameNight = (c: DeckContext) => [0, 1, 4, 6].includes(c.dow); // Sun, Mon, Thu, Sat
const isLate = (c: DeckContext) => c.hour >= 22.5;
const isEarly = (c: DeckContext) => c.hour < 20;
const isWeekend = (c: DeckContext) => [4, 5, 6].includes(c.dow);
const bigGroup = (c: DeckContext) => c.group >= 6;

export const CARDS: Card[] = [
  // ── Night out core ─────────────────────────────────────────
  {
    id: "dance",
    kind: "yesno",
    prompt: "Dancing?",
    sub: "Or at least a DJ and room to move.",
    art: ART.crimson,
    yesWants: { dance: 1, lively: 0.5, talk: -0.5 },
    noWants: { dance: -0.6 },
    core: true,
    mode: ["night"],
  },
  {
    id: "seat",
    kind: "yesno",
    prompt: "Need to sit?",
    sub: "A table, a booth, a stool with your name on it.",
    art: ART.forest,
    yesWants: { seating: 1, chill: 0.3 },
    noWants: { seating: -0.3 },
    core: true,
    mode: ["night"],
  },
  {
    id: "loud",
    kind: "either",
    prompt: "Loud or talk?",
    sub: "Pick the one you'll actually want at 11.",
    art: ART.cobalt,
    a: { label: "Loud", wants: { lively: 1, talk: -0.6 } },
    b: { label: "Talk", wants: { talk: 1, lively: -0.6 } },
    core: true,
    mode: ["night"],
  },
  {
    id: "line",
    kind: "yesno",
    prompt: "Okay with a line?",
    sub: "Some places are worth it. Some nights aren't.",
    art: ART.slate,
    yesWants: { noLine: -0.2 },
    noWants: { noLine: 1 },
    core: true,
    mode: ["night"],
  },
  {
    id: "table-for-all",
    kind: "yesno",
    prompt: "Table for all of you?",
    sub: "Somewhere that won't flinch at a big group.",
    art: ART.amber,
    yesWants: { groups: 1, seating: 0.7 },
    noWants: { groups: 0.3 },
    when: bigGroup,
    core: true,
    mode: ["night"],
  },
  {
    id: "game",
    kind: "yesno",
    prompt: "Game on?",
    sub: "Screens, sound, people who care.",
    art: ART.mint,
    yesWants: { sports: 1, seating: 0.3 },
    noWants: { sports: -0.5 },
    when: isGameNight,
    mode: ["night"],
  },
  {
    id: "late",
    kind: "yesno",
    prompt: "Late late?",
    sub: "Still going at 2.",
    art: ART.night,
    yesWants: { late: 1, lively: 0.3 },
    noWants: {},
    when: isLate,
    mode: ["night"],
  },
  {
    id: "hh",
    kind: "yesno",
    prompt: "Happy hour first?",
    sub: "A real deal before 8.",
    art: ART.amber,
    yesWants: { happyHour: 1, cheap: 0.4 },
    noWants: {},
    when: isEarly,
    mode: ["night"],
  },
  // ── Rotation ───────────────────────────────────────────────
  {
    id: "live",
    kind: "yesno",
    prompt: "Live music?",
    sub: "A band, a piano, someone with a mic.",
    art: ART.brass,
    yesWants: { liveMusic: 1 },
    noWants: { liveMusic: -0.3 },
    mode: ["night", "date"],
  },
  {
    id: "drink",
    kind: "either",
    prompt: "Cocktails or beer?",
    sub: "Be honest.",
    art: ART.plum,
    a: { label: "Cocktails", wants: { cocktails: 1 } },
    b: { label: "Beer", wants: { beer: 1, cheap: 0.3 } },
    mode: ["night"],
  },
  {
    id: "dive-nice",
    kind: "either",
    prompt: "Dive or nice?",
    sub: "Sticky floors or good glassware.",
    art: ART.slate,
    a: { label: "Dive", wants: { dive: 1, cheap: 0.5, upscale: -0.6 } },
    b: { label: "Nice", wants: { upscale: 1, dive: -0.6 } },
    mode: ["night"],
  },
  {
    id: "roof-basement",
    kind: "either",
    prompt: "Rooftop or basement?",
    sub: "Skyline or no windows at all.",
    art: ART.sea,
    a: { label: "Rooftop", wants: { rooftop: 1, outdoor: 0.6 } },
    b: { label: "Basement", wants: { speakeasy: 0.7, late: 0.3, lively: 0.3 } },
    mode: ["night"],
  },
  {
    id: "outside",
    kind: "yesno",
    prompt: "Outside?",
    sub: "Backyard, patio, sidewalk table.",
    art: ART.forest,
    yesWants: { outdoor: 1 },
    noWants: {},
    when: (c) => c.hour < 24,
    mode: ["night", "date"],
  },
  {
    id: "cheap",
    kind: "yesno",
    prompt: "Cheap night?",
    sub: "Under $10 a drink, mostly.",
    art: ART.ember,
    yesWants: { cheap: 1, upscale: -0.5 },
    noWants: {},
    mode: ["night"],
  },
  {
    id: "dressed",
    kind: "yesno",
    prompt: "Dressed up?",
    sub: "Or are we in sneakers.",
    art: ART.rose,
    yesWants: { dressy: 1, upscale: 0.6, dive: -0.5 },
    noWants: { dressy: -0.5 },
    mode: ["night", "date"],
  },
  {
    id: "old-ny",
    kind: "yesno",
    prompt: "Old New York?",
    sub: "Wood, brass, been there forever.",
    art: ART.brass,
    yesWants: { classic: 1 },
    noWants: {},
    mode: ["night", "date"],
  },
  {
    id: "meet",
    kind: "yesno",
    prompt: "Meet new people?",
    sub: "Somewhere strangers actually talk.",
    art: ART.crimson,
    yesWants: { social: 1, lively: 0.4 },
    noWants: {},
    mode: ["night"],
  },
  {
    id: "food",
    kind: "yesno",
    prompt: "Food too?",
    sub: "You're going to want fries.",
    art: ART.amber,
    yesWants: { food: 1 },
    noWants: {},
    mode: ["night", "date"],
  },
  {
    id: "new",
    kind: "yesno",
    prompt: "Somewhere new?",
    sub: "Skip the places you've already been.",
    art: ART.cobalt,
    yesWants: { new: 1 },
    noWants: {},
    mode: ["night", "date"],
  },
  {
    id: "activity",
    kind: "yesno",
    prompt: "Something to do?",
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
    kind: "yesno",
    prompt: "Sceney is fine?",
    sub: "Doormen, models, the whole thing.",
    art: ART.plum,
    yesWants: { scene: 1, dressy: 0.4 },
    noWants: { scene: -0.8 },
    mode: ["night"],
  },
  {
    id: "queer",
    kind: "yesno",
    prompt: "Queer night?",
    sub: "Where the night is, not just where it's welcome.",
    art: ART.rose,
    yesWants: { lgbtq: 1 },
    noWants: {},
    mode: ["night"],
  },
  // ── Date deck ──────────────────────────────────────────────
  {
    id: "d-hear",
    kind: "yesno",
    prompt: "Quiet enough to hear them?",
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
    id: "d-do",
    kind: "yesno",
    prompt: "Something to do?",
    sub: "Pool, a show, an excuse to move.",
    art: ART.mint,
    yesWants: { activity: 1, lively: 0.3 },
    noWants: {},
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
    late: ["Late", ""],
    happyHour: ["Happy hour", ""],
    liveMusic: ["Live music", "No live music"],
    cocktails: ["Cocktails", ""],
    beer: ["Beer", ""],
    wine: ["Wine", ""],
    dive: ["Dive", "No dive"],
    upscale: ["Nice", "Not fancy"],
    rooftop: ["Rooftop", ""],
    speakeasy: ["Hidden", ""],
    outdoor: ["Outside", ""],
    cheap: ["Cheap", ""],
    dressy: ["Dressed up", "Sneakers"],
    classic: ["Old New York", ""],
    social: ["Meet people", ""],
    food: ["Food", ""],
    new: ["Somewhere new", ""],
    activity: ["Something to do", ""],
    frozen: ["Frozen drinks", ""],
    scene: ["Sceney", "Not sceney"],
    lgbtq: ["Queer night", ""],
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
