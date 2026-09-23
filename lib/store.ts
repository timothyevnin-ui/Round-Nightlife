"use client";

import { useCallback, useSyncExternalStore } from "react";
import { TASTE_COOKIE } from "./tasteCookie";

/**
 * The person's own record: what they've saved, been to and rated, and how many
 * times they tapped GO. Local-first: localStorage is always the source of
 * truth for the screen, so everything works with no account and no network.
 *
 * When they're signed in, a "remote" adapter (registered by AuthProvider)
 * mirrors every write to Supabase, and sign-in merges the two histories.
 */

export type Verdict = "again" | "back" | "fine" | "never";
export type BeenEntry = {
  at: string;
  rating?: "loved" | "good" | "meh";
  crowd?: "room" | "wait" | "packed";
  /** "Rate this bar": the verdict in words. */
  verdict?: Verdict;
  /** What the room was, in the person's words (attribute keys). */
  tags?: string[];
  /** One line for the group chat. */
  note?: string;
};

/** The rating that the old parts of the app (taste profile, sync) understand. */
export function verdictToRating(v: Verdict | undefined): BeenEntry["rating"] | undefined {
  return v === "again" ? "loved" : v === "back" ? "good" : v ? "meh" : undefined;
}
export type SavedEntry = { at: string; source?: "flow" | "quiz" | "screenshot" | "venue" };

export type RoundState = {
  saved: Record<string, SavedEntry>;
  been: Record<string, BeenEntry>;
  quizDone: boolean;
  lastResults?: string; // path to the last results page, for the subway
  goCount: Record<string, number>; // GO taps per venue — the future partner receipt
  /** Your ladder: the places you'd go back to, best first (slugs). */
  ladder: string[];
  /** How you've answered the quick ones, by card id → answer label → times. ROUND learns your usual. */
  usual?: Record<string, Record<string, number>>;
};

export type Remote = {
  save(slug: string, entry: SavedEntry | null): void;
  been(slug: string, entry: BeenEntry | null): void;
  go(slug: string): void;
  ladder(order: string[]): void;
};

const KEY = "round:v1";
const EMPTY: RoundState = { saved: {}, been: {}, quizDone: false, goCount: {}, ladder: [] };

let cache: RoundState | null = null;
let remote: Remote | null = null;
const listeners = new Set<() => void>();

function read(): RoundState {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as RoundState) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: RoundState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. — state still lives in memory for the session */
  }
  syncTasteCookie(next);
  listeners.forEach((l) => l());
}

/**
 * A compact read of your taste that the results page (server) can see:
 * the top of your ladder, your never-agains, and the words you use for the
 * rooms you liked. No names, no numbers, just slugs and attribute keys.
 */
function syncTasteCookie(s: RoundState) {
  if (typeof document === "undefined") return;
  try {
    const loves = (s.ladder ?? []).slice(0, 8);
    const nevers = Object.entries(s.been)
      .filter(([, e]) => e.verdict === "never")
      .map(([slug]) => slug)
      .slice(0, 8);
    const counts: Record<string, number> = {};
    for (const [slug, e] of Object.entries(s.been)) if (e.verdict === "again" || e.verdict === "back") for (const t of e.tags ?? []) counts[t] = (counts[t] ?? 0) + (slug ? 1 : 0);
    const tags = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
    const usual = usualAnswers(s)
      .slice(0, 8)
      .map(([id, label]) => `${id}:${label.replace(/[^a-zA-Z0-9 -]/g, "").replace(/ /g, "_")}`);
    const value = `l=${loves.join(",")};n=${nevers.join(",")};t=${tags.join(",")};u=${usual.join(",")}`;
    const empty = !loves.length && !nevers.length && !tags.length && !usual.length;
    document.cookie = `${TASTE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${empty ? 0 : 31536000}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Your usual answers: a card you've answered the same way at least twice, and
 * more often than any other way. [cardId, label] pairs, most-answered first.
 */
export function usualAnswers(s: RoundState = read()): [string, string][] {
  const out: [string, string, number][] = [];
  for (const [id, counts] of Object.entries(s.usual ?? {})) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [label, n] = entries[0] ?? ["", 0];
    const total = entries.reduce((t, [, c]) => t + c, 0);
    if (n >= 2 && n / total >= 0.6) out.push([id, label, n]);
  }
  return out.sort((a, b) => b[2] - a[2]).map(([id, label]) => [id, label]);
}

/* ── the seam the account layer plugs into ── */

export function setRemote(r: Remote | null) {
  remote = r;
}

export function readState(): RoundState {
  return read();
}

/**
 * Merge an account's history into the local one. Union of both; a place that
 * is "been" on either side is been (a rating beats no rating; otherwise the
 * local entry wins), and a been place is never also "want to go".
 */
export function mergeState(incoming: Pick<RoundState, "saved" | "been"> & { ladder?: string[] }) {
  const s = read();
  const been: RoundState["been"] = { ...incoming.been };
  for (const [slug, local] of Object.entries(s.been)) {
    const other = been[slug];
    been[slug] = !other || local.rating || !other.rating ? { ...other, ...local } : other;
  }
  const saved: RoundState["saved"] = { ...incoming.saved, ...s.saved };
  for (const slug of Object.keys(been)) delete saved[slug];
  // Ladder: the account's order first, then anything only this phone ranked.
  const ladder = [...(incoming.ladder ?? []), ...(s.ladder ?? []).filter((x) => !(incoming.ladder ?? []).includes(x))].filter((x) => been[x]);
  write({ ...s, saved, been, ladder });
}

/** Sign-out: the account keeps everything; this phone forgets it. */
export function clearPersonal() {
  const s = read();
  write({ ...s, saved: {}, been: {}, ladder: [] });
}

export function useRoundStore() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggleSaved = useCallback((slug: string, source: SavedEntry["source"] = "venue") => {
    const s = read();
    const saved = { ...s.saved };
    let entry: SavedEntry | null = null;
    if (saved[slug]) delete saved[slug];
    else {
      entry = { at: new Date().toISOString(), source };
      saved[slug] = entry;
    }
    write({ ...s, saved });
    remote?.save(slug, entry);
    return !!entry;
  }, []);

  const markBeen = useCallback((slug: string, entry: Partial<BeenEntry> = {}) => {
    const s = read();
    const prev = s.been[slug];
    const saved = { ...s.saved };
    delete saved[slug];
    const next: BeenEntry = { ...prev, ...entry, at: prev?.at ?? new Date().toISOString() };
    write({ ...s, saved, been: { ...s.been, [slug]: next } });
    remote?.been(slug, next);
  }, []);

  const clearBeen = useCallback((slug: string) => {
    const s = read();
    const been = { ...s.been };
    delete been[slug];
    const ladder = (s.ladder ?? []).filter((x) => x !== slug);
    write({ ...s, been, ladder });
    remote?.been(slug, null);
    if (ladder.length !== (s.ladder ?? []).length) remote?.ladder(ladder);
  }, []);

  /**
   * "Rate this bar": records the verdict, the tags and the note, and puts the
   * place on your ladder at `position` (0 = the top) when it's one you'd go
   * back to; a "fine" or "never" comes off the ladder.
   */
  const rate = useCallback((slug: string, entry: { verdict: Verdict; tags?: string[]; note?: string }, position?: number) => {
    const s = read();
    const prev = s.been[slug];
    const saved = { ...s.saved };
    delete saved[slug];
    const next: BeenEntry = { ...prev, ...entry, rating: verdictToRating(entry.verdict), at: prev?.at ?? new Date().toISOString() };
    let ladder = (s.ladder ?? []).filter((x) => x !== slug);
    if (entry.verdict === "again" || entry.verdict === "back") {
      const at = Math.max(0, Math.min(ladder.length, position ?? ladder.length));
      ladder = [...ladder.slice(0, at), slug, ...ladder.slice(at)];
    }
    write({ ...s, saved, been: { ...s.been, [slug]: next }, ladder });
    remote?.been(slug, next);
    remote?.ladder(ladder);
    return ladder.indexOf(slug);
  }, []);

  /** A quick one answered: ROUND remembers, and next time marks your usual. */
  const remember = useCallback((cardId: string, label: string) => {
    const s = read();
    const card = { ...(s.usual?.[cardId] ?? {}) };
    card[label] = (card[label] ?? 0) + 1;
    write({ ...s, usual: { ...(s.usual ?? {}), [cardId]: card } });
  }, []);

  const setQuizDone = useCallback((done: boolean) => write({ ...read(), quizDone: done }), []);

  const rememberResults = useCallback((path: string) => write({ ...read(), lastResults: path }), []);

  const recordGo = useCallback((slug: string) => {
    const s = read();
    write({ ...s, goCount: { ...s.goCount, [slug]: (s.goCount[slug] ?? 0) + 1 } });
    remote?.go(slug);
  }, []);

  return { state, toggleSaved, markBeen, clearBeen, rate, remember, setQuizDone, rememberResults, recordGo };
}
