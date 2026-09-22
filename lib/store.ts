"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The person's own record: what they've saved, been to and rated, and how many
 * times they tapped GO. Local-first: localStorage is always the source of
 * truth for the screen, so everything works with no account and no network.
 *
 * When they're signed in, a "remote" adapter (registered by AuthProvider)
 * mirrors every write to Supabase, and sign-in merges the two histories.
 */

export type BeenEntry = { at: string; rating?: "loved" | "good" | "meh"; crowd?: "room" | "wait" | "packed" };
export type SavedEntry = { at: string; source?: "flow" | "quiz" | "screenshot" | "venue" };

export type RoundState = {
  saved: Record<string, SavedEntry>;
  been: Record<string, BeenEntry>;
  quizDone: boolean;
  lastResults?: string; // path to the last results page, for the subway
  goCount: Record<string, number>; // GO taps per venue — the future partner receipt
};

export type Remote = {
  save(slug: string, entry: SavedEntry | null): void;
  been(slug: string, entry: BeenEntry | null): void;
  go(slug: string): void;
};

const KEY = "round:v1";
const EMPTY: RoundState = { saved: {}, been: {}, quizDone: false, goCount: {} };

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
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
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
export function mergeState(incoming: Pick<RoundState, "saved" | "been">) {
  const s = read();
  const been: RoundState["been"] = { ...incoming.been };
  for (const [slug, local] of Object.entries(s.been)) {
    const other = been[slug];
    been[slug] = !other || local.rating || !other.rating ? { ...other, ...local } : other;
  }
  const saved: RoundState["saved"] = { ...incoming.saved, ...s.saved };
  for (const slug of Object.keys(been)) delete saved[slug];
  write({ ...s, saved, been });
}

/** Sign-out: the account keeps everything; this phone forgets it. */
export function clearPersonal() {
  const s = read();
  write({ ...s, saved: {}, been: {} });
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
    write({ ...s, been });
    remote?.been(slug, null);
  }, []);

  const setQuizDone = useCallback((done: boolean) => write({ ...read(), quizDone: done }), []);

  const rememberResults = useCallback((path: string) => write({ ...read(), lastResults: path }), []);

  const recordGo = useCallback((slug: string) => {
    const s = read();
    write({ ...s, goCount: { ...s.goCount, [slug]: (s.goCount[slug] ?? 0) + 1 } });
    remote?.go(slug);
  }, []);

  return { state, toggleSaved, markBeen, clearBeen, setQuizDone, rememberResults, recordGo };
}
