import { ATTR_KEYS, type AttrKey } from "./attrs";

/**
 * The question pool (V32). When someone rates a place, ROUND asks "Best
 * for?" and then whatever it still needs to know about that place. The
 * questions aren't a fixed list: the AI writes them from what New Yorkers
 * type into "just say it" (lib/pool.ts), so the pool follows the asks. Every
 * option maps onto the traits the picker scores on, so each tap teaches it.
 * This file is the shape, the seed the pool starts from, and the chooser.
 */

export type QOption = {
  key: string;
  label: string;
  /** What choosing this says about the place, 0–1 per trait. */
  attrs?: Partial<Record<AttrKey, number>>;
  /** A badge on the card once enough people agree ("Always packed"). */
  badge?: string;
};

export type CrowdQuestion = {
  id: string;
  kind: "bar" | "restaurant" | "both";
  /** "best": the Best-for chips (one per kind). "ask": everything else. */
  role: "best" | "ask";
  prompt: string;
  sub?: string;
  multi: boolean;
  options: QOption[];
  /** How much the city asks for this: 0–3, from the asks. Higher gets asked sooner. */
  demand: number;
  /** The ask (or cluster of asks) this came from. */
  from?: string;
  /** A question written for one place ("Is there a band every night?"). */
  slug?: string;
  active: boolean;
  /** Written by the AI (false for the seed and for anything you reworded). */
  ai?: boolean;
};

const o = (key: string, label: string, attrs?: QOption["attrs"], badge?: string): QOption => ({ key, label, ...(attrs ? { attrs } : {}), ...(badge ? { badge } : {}) });

/** The pool before the AI has read a single ask. */
export const SEED_QUESTIONS: CrowdQuestion[] = [
  {
    id: "best-bar",
    kind: "bar",
    role: "best",
    prompt: "What's it best for?",
    sub: "Pick as many as are true.",
    multi: true,
    demand: 3,
    active: true,
    options: [
      o("late", "Late night", { late: 1 }),
      o("dance", "Dancing", { dance: 1, lively: 0.8 }),
      o("liveMusic", "Live music", { liveMusic: 1 }),
      o("pregame", "Drinks before going out", { social: 0.6, lively: 0.6 }),
      o("chill", "Chill", { chill: 1, talk: 0.7 }),
      o("game", "Watching the game", { sports: 1 }),
      o("date", "A date", { date: 1 }),
      o("group", "The whole group", { groups: 1 }),
      o("day", "Day drinking", { daytime: 1 }),
      o("happyHour", "Happy hour", { happyHour: 1 }),
    ],
  },
  {
    id: "best-restaurant",
    kind: "restaurant",
    role: "best",
    prompt: "What's it best for?",
    sub: "Pick as many as are true.",
    multi: true,
    demand: 3,
    active: true,
    options: [
      o("date", "A date", { date: 1 }),
      o("pregame", "Before going out", { social: 0.5 }),
      o("group", "The group", { groups: 1 }),
      o("meal", "A real meal", { food: 1 }),
      o("impress", "Impressing someone", { upscale: 0.9, date: 0.6 }),
      o("brunch", "Brunch", { daytime: 1 }),
      o("barDrinks", "Drinks at the bar", { cocktails: 0.7 }),
      o("quick", "A quick bite", { cheap: 0.5 }),
    ],
  },
  {
    id: "packed",
    kind: "both",
    role: "ask",
    prompt: "How packed was it?",
    multi: false,
    demand: 2,
    active: true,
    options: [o("dead", "Dead", { lively: 0.1, seating: 0.9 }), o("comfortable", "Comfortable", { lively: 0.5, seating: 0.7 }), o("shoulder", "Shoulder to shoulder", { lively: 0.9, seating: 0.2 }, "Always packed"), o("couldntMove", "Couldn't move", { lively: 1, seating: 0 }, "Always packed")],
  },
  {
    id: "talk",
    kind: "both",
    role: "ask",
    prompt: "Could you hear each other?",
    multi: false,
    demand: 2.5,
    active: true,
    options: [o("every", "Every word", { talk: 1, lively: 0.2 }), o("lean", "Had to lean in", { talk: 0.5, lively: 0.6 }), o("yell", "Just yelled", { talk: 0, lively: 1 })],
  },
  {
    id: "crowd",
    kind: "both",
    role: "ask",
    prompt: "Who was there?",
    multi: true,
    demand: 1.5,
    active: true,
    options: [o("locals", "Locals", { classic: 0.4 }), o("scene", "A scene", { scene: 1 }), o("finance", "Finance", { scene: 0.5, upscale: 0.5 }), o("tourists", "Tourists", { classic: 0.2 }), o("everyone", "Everyone", { social: 0.5 }), o("goodPeople", "Good people", { social: 0.7 }, "Good people")],
  },
  {
    id: "round",
    kind: "bar",
    role: "ask",
    prompt: "A round for four?",
    multi: false,
    demand: 2,
    active: true,
    options: [o("under40", "Under $40", { cheap: 1, upscale: 0.1 }), o("40to70", "$40 to $70", { cheap: 0.4 }), o("dontAsk", "Don't ask", { cheap: 0, upscale: 0.9 })],
  },
  {
    id: "when",
    kind: "both",
    role: "ask",
    prompt: "When's it good?",
    multi: true,
    demand: 1.5,
    active: true,
    options: [o("early", "Early", { chill: 0.4 }), o("peak", "Peak", { lively: 0.6 }), o("lastCall", "Last call", { late: 1 }), o("weeknights", "Weeknights", { chill: 0.3 }), o("weekendsOnly", "Weekends only"), o("day", "Daytime", { daytime: 1 })],
  },
  {
    id: "bring",
    kind: "both",
    role: "ask",
    prompt: "Who would you bring?",
    multi: true,
    demand: 1.5,
    active: true,
    options: [o("date", "A date", { date: 1 }), o("group", "The group", { groups: 1 }), o("parents", "Your parents", { upscale: 0.5, talk: 0.6, dive: 0.1 }, "Parent-approved"), o("solo", "Just yourself", { social: 0.7, chill: 0.4 })],
  },
  {
    id: "drinks",
    kind: "bar",
    role: "ask",
    prompt: "What did you drink?",
    multi: true,
    demand: 1,
    active: true,
    options: [o("beer", "Beer", { beer: 1 }), o("cocktails", "Cocktails", { cocktails: 1 }), o("wine", "Wine", { wine: 1 }), o("shots", "Shots", { lively: 0.5, cheap: 0.3 }), o("frozen", "Something frozen", { frozen: 1 }), o("slow", "Took forever", undefined, "Slow bar")],
  },
  {
    id: "food",
    kind: "restaurant",
    role: "ask",
    prompt: "How's the food?",
    multi: false,
    demand: 2.5,
    active: true,
    options: [o("must", "Must-order", { food: 1 }), o("solid", "Solid", { food: 0.7 }), o("okay", "Just okay", { food: 0.3 }), o("scene", "You're there for the scene", { scene: 0.9, food: 0.2 })],
  },
  {
    id: "scene",
    kind: "restaurant",
    role: "ask",
    prompt: "The scene?",
    multi: true,
    demand: 2,
    active: true,
    options: [o("buzzy", "Buzzy", { lively: 0.8, scene: 0.6 }), o("classy", "Classy", { upscale: 1 }), o("chill", "Chill", { chill: 1 }), o("loud", "Loud", { lively: 1, talk: 0 })],
  },
  {
    id: "dressed",
    kind: "restaurant",
    role: "ask",
    prompt: "How dressed?",
    multi: false,
    demand: 1.5,
    active: true,
    options: [o("whatever", "Whatever you had on", { dressy: 0 }), o("effort", "Made an effort", { dressy: 0.5 }), o("up", "Dressed up", { dressy: 1 })],
  },
];

/* ───────────────────────── the chooser ───────────────────────── */

export type Coverage = Record<string, number>; // question id → answers about this place

/** Can this question be asked about this kind of place? */
export function applies(q: CrowdQuestion, kind: "bar" | "restaurant", slug?: string): boolean {
  if (!q.active) return false;
  if (q.slug && q.slug !== slug) return false;
  return q.kind === "both" || q.kind === kind;
}

/** The Best-for question for a kind of place. */
export function bestQuestion(pool: CrowdQuestion[], kind: "bar" | "restaurant"): CrowdQuestion | undefined {
  return pool.find((q) => q.role === "best" && q.active && (q.kind === kind || q.kind === "both"));
}

/**
 * What to ask about this place, in order: the questions the city asks for
 * most and this place knows least, skipping anything this person already
 * answered here. A question written for this place goes first.
 */
export function chooseQuestions(pool: CrowdQuestion[], kind: "bar" | "restaurant", slug: string, coverage: Coverage, done: string[] = [], max = 8): CrowdQuestion[] {
  const score = (q: CrowdQuestion) => (q.slug ? 10 : 0) + (q.demand || 1) / (1 + (coverage[q.id] ?? 0) / 4);
  return pool
    .filter((q) => q.role === "ask" && applies(q, kind, slug) && !done.includes(q.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, max);
}

/** How well ROUND knows a place, 0–100: five answers to a question count as knowing it. */
export function knownPercent(pool: CrowdQuestion[], kind: "bar" | "restaurant", slug: string, coverage: Coverage): number {
  const qs = pool.filter((q) => q.role === "ask" && applies(q, kind, slug));
  if (!qs.length) return 0;
  const sum = qs.reduce((t, q) => t + Math.min(1, (coverage[q.id] ?? 0) / 5), 0);
  return Math.round((100 * sum) / qs.length);
}

/** The trait keys a set of answers speaks for (value ≥ 0.7), for the taste cookie and the old tag views. */
export function tagsFromAnswers(pool: CrowdQuestion[], bestFor: string[], answers: Record<string, string[]>, kind: "bar" | "restaurant"): string[] {
  const out = new Set<string>();
  const best = bestQuestion(pool, kind);
  for (const k of bestFor) for (const [a, v] of Object.entries(best?.options.find((x) => x.key === k)?.attrs ?? {})) if ((v ?? 0) >= 0.7) out.add(a);
  for (const [qid, keys] of Object.entries(answers)) {
    const q = pool.find((x) => x.id === qid);
    for (const k of keys) for (const [a, v] of Object.entries(q?.options.find((x) => x.key === k)?.attrs ?? {})) if ((v ?? 0) >= 0.7) out.add(a);
  }
  return [...out].slice(0, 8);
}

/* ───────────────────────── cleaning (what the AI and the Studio hand back) ───────────────────────── */

const KEY_RE = /^[a-z][a-zA-Z0-9-]{0,39}$/;

/** A question as it comes back from the model or a form: everything checked, nothing trusted. */
export function cleanQuestion(raw: unknown): CrowdQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim().toLowerCase().replace(/[^a-z0-9:-]/g, "-").slice(0, 48) : "";
  const prompt = typeof r.prompt === "string" ? r.prompt.trim().slice(0, 90) : "";
  if (!id || !prompt) return null;
  const kind = r.kind === "bar" || r.kind === "restaurant" ? r.kind : "both";
  const role = r.role === "best" ? "best" : "ask";
  const seen = new Set<string>();
  const options: QOption[] = (Array.isArray(r.options) ? r.options : [])
    .map((x): QOption | null => {
      if (!x || typeof x !== "object") return null;
      const op = x as Record<string, unknown>;
      const label = typeof op.label === "string" ? op.label.trim().slice(0, 32) : "";
      let key = typeof op.key === "string" ? op.key.trim() : "";
      if (!KEY_RE.test(key)) key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
      if (!label || !key || seen.has(key)) return null;
      seen.add(key);
      const attrs: Partial<Record<AttrKey, number>> = {};
      if (op.attrs && typeof op.attrs === "object") {
        for (const [k, v] of Object.entries(op.attrs as Record<string, unknown>)) {
          const n = Number(v);
          if ((ATTR_KEYS as readonly string[]).includes(k) && Number.isFinite(n)) attrs[k as AttrKey] = Math.max(0, Math.min(1, n));
        }
      }
      const badge = typeof op.badge === "string" && op.badge.trim() ? op.badge.trim().slice(0, 24) : undefined;
      return { key, label, ...(Object.keys(attrs).length ? { attrs } : {}), ...(badge ? { badge } : {}) };
    })
    .filter((x): x is QOption => !!x)
    .slice(0, 8);
  if (options.length < 2) return null;
  const demand = Number(r.demand);
  const slug = typeof r.slug === "string" && r.slug.trim() ? r.slug.trim().slice(0, 80) : undefined;
  return {
    id,
    kind,
    role,
    prompt,
    sub: typeof r.sub === "string" && r.sub.trim() ? r.sub.trim().slice(0, 90) : undefined,
    multi: role === "best" ? true : !!r.multi,
    options,
    demand: Number.isFinite(demand) ? Math.max(0, Math.min(3, demand)) : 1,
    from: typeof r.from === "string" && r.from.trim() ? r.from.trim().slice(0, 160) : undefined,
    ...(slug ? { slug } : {}),
    active: r.active === undefined ? true : !!r.active,
    ai: !!r.ai,
  };
}
