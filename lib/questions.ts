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

export type Option = { label: string; wants: Wants };

export type Card = {
  id: string;
  /** Typed out on screen, one character at a time. */
  prompt: string;
  /** Two or three buttons. */
  options: Option[];
  /** Show only when the context matches. */
  when?: (ctx: DeckContext) => boolean;
  /** Show only when the answers so far make it worth asking (a yes to dancing makes "loud?" redundant). */
  showIf?: (wants: Wants) => boolean;
  /** Always included when `when` passes, in this order; the rest rotate. A function when the place in the run depends on the hour. */
  order?: number | ((ctx: DeckContext) => number);
  mode: DeckMode[];
};

export type DeckContext = {
  mode: DeckMode;
  group: number;
  hour: number; // 24h, 24+ after midnight
  dow: number; // 0 Sun … 6 Sat
  neighborhood: string;
};

const YES_NO = (yes: Wants, no: Wants = {}): Option[] => [
  { label: "Yes", wants: yes },
  { label: "No", wants: no },
];

const PRICE: Option[] = [
  { label: "$", wants: { cheap: 1, upscale: -0.5, dive: 0.2 } },
  { label: "$$", wants: { cheap: 0.2, upscale: 0.2 } },
  { label: "$$$", wants: { upscale: 1, dressy: 0.3, cheap: -0.6, cocktails: 0.3 } },
];

/** No dress code anywhere in ROUND, nothing to overthink. The question is the room: bougie or chill. */
const BOUGIE_OR_CHILL: Option[] = [
  { label: "Bougie", wants: { upscale: 1, scene: 0.4, cocktails: 0.3, dressy: 0.5, dive: -0.6 } },
  { label: "Chill", wants: { chill: 1, dive: 0.4, cheap: 0.3, upscale: -0.6, dressy: -0.4 } },
];

const isGameNight = (c: DeckContext) => [0, 1, 4, 6].includes(c.dow); // Sun, Mon, Thu, Sat
const isDaytime = (c: DeckContext) => c.hour < 19;
/** A day out: before 5pm the questions change (sun, a game, a deal), and "how late" is beside the point. */
const isDay = (c: DeckContext) => c.hour >= 5 && c.hour < 17;
const isNight = (c: DeckContext) => !isDay(c);
/**
 * The night has chapters, and the first question should know which one it's
 * in. At 7:45 nobody is asking about dancing: the night is getting started
 * (a drink, a deal, something to eat, a seat). Around 9 it wants a pulse.
 * After 10:30 it's dancing, how late, and whether you'd stand in a line.
 */
const isEarly = (c: DeckContext) => isNight(c) && c.hour >= 17 && c.hour < 20.5;
const isMid = (c: DeckContext) => c.hour >= 20.5 && c.hour < 22.5;
const isLate = (c: DeckContext) => c.hour >= 22.5;
const notEarly = (c: DeckContext) => isMid(c) || isLate(c);
const bigGroup = (c: DeckContext) => c.group >= 6;
const beforeMidnight = (c: DeckContext) => c.hour < 24;

export const CARDS: Card[] = [
  /* ── Day out: the fixed run before 5pm ── */
  {
    id: "sun",
    prompt: "Sun or shade?",
    options: [
      { label: "Sun", wants: { outdoor: 1, rooftop: 0.5, daytime: 0.6 } },
      { label: "Shade", wants: { seating: 0.5, chill: 0.4, daytime: 0.4 } },
      { label: "Either", wants: { daytime: 0.6 } },
    ],
    when: isDay,
    order: 1,
    mode: ["night"],
  },
  { id: "dayvibe", prompt: "Lazy afternoon, or a proper day out?", options: [{ label: "Lazy", wants: { chill: 1, seating: 0.6, talk: 0.5, lively: -0.5 } }, { label: "Proper", wants: { lively: 0.9, social: 0.5, cheap: 0.3 } }], when: isDay, order: 2, mode: ["night"] },
  { id: "daydeal", prompt: "Deal hunting?", options: YES_NO({ happyHour: 1, cheap: 0.8 }, { upscale: 0.2 }), when: isDay, order: 5, mode: ["night"] },
  { id: "daygame", prompt: "Is there a game on?", options: YES_NO({ sports: 1, seating: 0.3 }, { sports: -0.5 }), when: isDay, order: 6, mode: ["night"] },
  { id: "dayfood", prompt: "Will you want to eat?", options: YES_NO({ food: 1, seating: 0.3 }, { food: -0.2 }), when: isDay, order: 7, mode: ["night"] },

  /* ── Night out, early (5–8:30pm): getting the night started ── */
  {
    id: "start",
    prompt: "Getting the night started, or is this the night?",
    options: [
      { label: "Getting started", wants: { chill: 0.5, seating: 0.6, talk: 0.5, happyHour: 0.4, lively: -0.3, late: -0.3 } },
      { label: "This is the night", wants: { lively: 0.6, late: 0.3, social: 0.2 } },
    ],
    when: isEarly,
    order: 1,
    mode: ["night"],
  },
  { id: "hh", prompt: "Want a happy hour deal?", options: YES_NO({ happyHour: 1, cheap: 0.4 }), when: (c) => isEarly(c) && isDaytime(c), order: 2, mode: ["night"] },
  {
    id: "eat",
    prompt: "Eating too, or just drinks?",
    options: [
      { label: "Eating", wants: { food: 1, seating: 0.4 } },
      { label: "Just drinks", wants: { food: -0.2 } },
    ],
    when: isEarly,
    order: 3,
    mode: ["night"],
  },
  {
    id: "pulse",
    prompt: "Somewhere to talk, or something with a pulse?",
    options: [
      { label: "Talk", wants: { talk: 1, chill: 0.5, lively: -0.5 } },
      { label: "A pulse", wants: { lively: 0.8, social: 0.3 } },
    ],
    when: isEarly,
    order: 4,
    mode: ["night"],
  },

  /* ── Night out, 8:30–10:30: a little more lively ── */
  {
    id: "lively",
    prompt: "Lively, or somewhere to sit and talk?",
    options: [
      { label: "Lively", wants: { lively: 1, social: 0.4, talk: -0.4 } },
      { label: "Sit and talk", wants: { talk: 1, seating: 0.7, lively: -0.6 } },
    ],
    when: isMid,
    order: 1,
    mode: ["night"],
  },
  // Same id as the late card on purpose: one "dance" answer ROUND learns, two ways of asking it. The late one is listed first so it's the one a lookup by id finds.
  { id: "dance", prompt: "Do you want to dance?", options: YES_NO({ dance: 1, lively: 0.5, talk: -0.5 }, { dance: -0.6 }), when: isLate, order: 1, mode: ["night"] },
  { id: "dance", prompt: "Feel like dancing later?", options: YES_NO({ dance: 1, lively: 0.5, talk: -0.5 }, { dance: -0.6 }), when: isMid, order: 2, mode: ["night"] },

  /* ── Night out, after 10:30: the night itself ── */
  // Said yes to dancing: "loud?" answers itself, so ask what kind of dancing instead.
  {
    id: "band",
    prompt: "DJ or a band?",
    options: [
      { label: "DJ", wants: { dance: 0.3, scene: 0.2, liveMusic: -0.3 } },
      { label: "A band", wants: { liveMusic: 1 } },
      { label: "Either", wants: {} },
    ],
    showIf: (w) => (w.dance ?? 0) > 0,
    when: notEarly,
    order: (c) => (isMid(c) ? 3 : 2),
    mode: ["night"],
  },
  {
    id: "loud",
    prompt: "Loud or not?",
    options: [
      { label: "Loud", wants: { lively: 1, talk: -0.6 } },
      { label: "Not loud", wants: { talk: 1, lively: -0.6 } },
    ],
    showIf: (w) => (w.dance ?? 0) <= 0,
    when: isLate,
    order: 2,
    mode: ["night"],
  },
  // Live music, but which kind of night: a room that listens, or one that shouts along.
  {
    id: "listen",
    prompt: "Sit and listen, or stand and sing along?",
    options: [
      { label: "Sit and listen", wants: { seating: 1, talk: 0.4, lively: -0.3 } },
      { label: "Sing along", wants: { lively: 0.8, seating: -0.4 } },
    ],
    showIf: (w) => (w.liveMusic ?? 0) > 0,
    when: notEarly,
    order: 3,
    mode: ["night"],
  },
  {
    id: "seat",
    prompt: "Seats or standing?",
    options: [
      { label: "Seats", wants: { seating: 1, chill: 0.3 } },
      { label: "Standing", wants: { seating: -0.4, lively: 0.3 } },
    ],
    showIf: (w) => (w.dance ?? 0) <= 0 && (w.liveMusic ?? 0) <= 0,
    when: isNight,
    order: (c) => (isEarly(c) ? 5 : 3),
    mode: ["night"],
  },
  { id: "line", prompt: "Would you wait in a line?", options: YES_NO({ noLine: -0.2, scene: 0.3 }, { noLine: 1 }), when: notEarly, order: 4, mode: ["night"] },
  { id: "price", prompt: "What are we spending?", options: PRICE, order: 6, mode: ["night", "date", "dinner"] },
  { id: "outside", prompt: "Outside if it's nice?", options: YES_NO({ outdoor: 1 }), when: (c) => beforeMidnight(c) && (c.mode !== "night" || isNight(c)), order: 7, mode: ["night", "date", "dinner"] },

  /* ── Night out: when it fits ── */
  { id: "game", prompt: "Is there a game on?", options: YES_NO({ sports: 1, seating: 0.3 }, { sports: -0.5 }), when: (c) => isGameNight(c) && isNight(c), order: 8, mode: ["night"] },
  {
    id: "late",
    prompt: "How late are we going?",
    options: [
      { label: "Home by 1", wants: { late: -0.3, chill: 0.3 } },
      { label: "Late late", wants: { late: 1, lively: 0.3 } },
    ],
    when: isLate,
    order: 5,
    mode: ["night"],
  },
  { id: "birthday", prompt: "Is it someone's birthday?", options: YES_NO({ lively: 0.7, groups: 0.7, activity: 0.3 }), when: (c) => c.group >= 4, order: 10, mode: ["night"] },

  /* ── Night out: rotation ── */
  {
    id: "drink",
    prompt: "Cocktails or beers?",
    options: [
      { label: "Cocktails", wants: { cocktails: 1 } },
      { label: "Beers", wants: { beer: 1, cheap: 0.3 } },
    ],
    mode: ["night"],
  },
  {
    id: "dive-nice",
    prompt: "Dive bar or nice bar?",
    options: [
      { label: "Dive", wants: { dive: 1, cheap: 0.5, upscale: -0.6 } },
      { label: "Nice", wants: { upscale: 1, dive: -0.6 } },
    ],
    mode: ["night"],
  },
  {
    id: "old-ny",
    prompt: "Old New York or new New York?",
    options: [
      { label: "Old", wants: { classic: 1 } },
      { label: "New", wants: { scene: 0.4, new: 0.5, classic: -0.4 } },
    ],
    mode: ["night", "date"],
  },
  {
    id: "roof",
    prompt: "Rooftop or basement?",
    options: [
      { label: "Rooftop", wants: { rooftop: 1, outdoor: 0.6 } },
      { label: "Basement", wants: { speakeasy: 0.7, late: 0.3, lively: 0.3 } },
    ],
    when: beforeMidnight,
    mode: ["night"],
  },
  { id: "live", prompt: "Live music?", options: YES_NO({ liveMusic: 1 }, { liveMusic: -0.3 }), mode: ["night", "date"] },
  { id: "activity", prompt: "Pool, darts, karaoke?", options: YES_NO({ activity: 1 }), mode: ["night"] },
  { id: "meet", prompt: "Trying to meet people?", options: YES_NO({ social: 1, lively: 0.4 }), mode: ["night"] },
  { id: "new", prompt: "Somewhere none of you have been?", options: YES_NO({ new: 1 }), mode: ["night", "date", "dinner"] },
  { id: "bougie", prompt: "Bougie or chill?", options: BOUGIE_OR_CHILL, mode: ["night", "date"] },

  /* ── Date ── */
  { id: "d-hear", prompt: "Need to hear each other?", options: YES_NO({ talk: 1, lively: -0.5 }, { lively: 0.5 }), order: 1, mode: ["date"] },
  { id: "d-light", prompt: "Low light?", options: YES_NO({ date: 1, cocktails: 0.4 }), order: 2, mode: ["date"] },
  {
    id: "d-impress",
    prompt: "Impress or relax?",
    options: [
      { label: "Impress", wants: { upscale: 1, dressy: 0.6, cocktails: 0.4 } },
      { label: "Relax", wants: { chill: 1, dive: 0.3, cheap: 0.3 } },
    ],
    order: 3,
    mode: ["date"],
  },
  {
    id: "d-wine",
    prompt: "Wine or cocktails?",
    options: [
      { label: "Wine", wants: { wine: 1 } },
      { label: "Cocktails", wants: { cocktails: 1 } },
    ],
    order: 4,
    mode: ["date"],
  },
  { id: "d-do", prompt: "Something to do together?", options: YES_NO({ activity: 1, lively: 0.3 }), mode: ["date"] },
  {
    id: "d-exit",
    prompt: "One drink or the whole night?",
    options: [
      { label: "One drink", wants: { chill: 0.4, seating: 0.4, late: -0.3 } },
      { label: "Whole night", wants: { date: 0.5, late: 0.4, food: 0.3 } },
    ],
    mode: ["date"],
  },
  {
    id: "d-buzz",
    prompt: "Buzzy or hidden?",
    options: [
      { label: "Buzzy", wants: { lively: 0.6, scene: 0.4 } },
      { label: "Hidden", wants: { speakeasy: 0.8, talk: 0.4 } },
    ],
    mode: ["date"],
  },

  /* ── Dinner & drinks (groups) ── */
  {
    id: "g-share",
    prompt: "Sharing plates or everyone orders?",
    options: [
      { label: "Share", wants: { groups: 0.8, lively: 0.4 } },
      { label: "Own plate", wants: { seating: 0.5, classic: 0.3 } },
    ],
    order: 1,
    mode: ["dinner"],
  },
  {
    id: "g-loud",
    prompt: "Loud and fun or nice and calm?",
    options: [
      { label: "Loud & fun", wants: { lively: 0.9, talk: -0.3 } },
      { label: "Nice & calm", wants: { talk: 0.9, upscale: 0.4 } },
    ],
    order: 2,
    mode: ["dinner"],
  },
  {
    id: "g-after",
    prompt: "After dinner: dancing or a nightcap?",
    options: [
      { label: "Nightcap", wants: { chill: 0.7, cocktails: 0.5, talk: 0.4 } },
      { label: "Dancing", wants: { dance: 1, lively: 0.6, late: 0.4 } },
    ],
    order: 3,
    mode: ["dinner"],
  },
  { id: "g-book", prompt: "Need somewhere you can book?", options: YES_NO({ groups: 0.8, seating: 0.6 }, { noLine: 0.5 }), when: bigGroup, order: 8, mode: ["dinner"] },
  {
    id: "g-classic",
    prompt: "A classic or something new?",
    options: [
      { label: "Classic", wants: { classic: 1 } },
      { label: "New", wants: { scene: 0.5, new: 0.5 } },
    ],
    mode: ["dinner"],
  },
  { id: "g-bougie", prompt: "Bougie or chill?", options: BOUGIE_OR_CHILL, mode: ["dinner"] },
];

/** The fixed run in order, then a rotating extra or two, capped at `size`. */
export function pickDeck(ctx: DeckContext, size = 8, seed = Date.now()): Card[] {
  const eligible = CARDS.filter((c) => c.mode.includes(ctx.mode) && (!c.when || c.when(ctx)));
  const ord = (c: Card) => (typeof c.order === "function" ? c.order(ctx) : c.order);
  const fixed = eligible.filter((c) => c.order !== undefined).sort((a, b) => ord(a)! - ord(b)!);
  const rest = eligible.filter((c) => c.order === undefined);
  // Deterministic shuffle so a refresh doesn't reshuffle mid-deck.
  let s = seed % 2147483647;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const shuffled = [...rest].sort(() => rnd() - 0.5);
  // Branching cards share an `order` slot; only one of each slot ever shows, so the deck can carry a spare.
  const slots = new Set(fixed.map(ord));
  return [...fixed, ...shuffled].slice(0, size + (fixed.length - slots.size));
}

/** The next card worth asking, given what's been answered so far. */
export function nextCard(cards: Card[], from: number, wants: Wants): number {
  for (let k = from; k < cards.length; k++) {
    const c = cards[k];
    if (!c.showIf || c.showIf(wants)) return k;
  }
  return cards.length;
}

/** Merge a card answer (an option index, or skip) into the running wants. */
export function applyAnswer(wants: Wants, card: Card, answer: number | "skip"): Wants {
  const delta: Wants = answer === "skip" ? {} : card.options[answer]?.wants ?? {};
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
    daytime: ["Day out", "Not a day place"],
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
    upscale: ["Bougie", "Not fancy"],
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
