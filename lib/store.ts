"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * V1 store: an anonymous, local-first record of what you've saved, been to and
 * rated. Lives in localStorage now; the same shape moves to Supabase when phone
 * sign-in arrives, and the anonymous history merges into the account.
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

const KEY = "round:v1";
const EMPTY: RoundState = { saved: {}, been: {}, quizDone: false, goCount: {} };

let cache: RoundState | null = null;
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

export function useRoundStore() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggleSaved = useCallback((slug: string, source: SavedEntry["source"] = "venue") => {
    const s = read();
    const saved = { ...s.saved };
    if (saved[slug]) delete saved[slug];
    else saved[slug] = { at: new Date().toISOString(), source };
    write({ ...s, saved });
  }, []);

  const markBeen = useCallback((slug: string, entry: Partial<BeenEntry> = {}) => {
    const s = read();
    const prev = s.been[slug];
    const saved = { ...s.saved };
    delete saved[slug];
    write({ ...s, saved, been: { ...s.been, [slug]: { ...prev, ...entry, at: prev?.at ?? new Date().toISOString() } } });
  }, []);

  const clearBeen = useCallback((slug: string) => {
    const s = read();
    const been = { ...s.been };
    delete been[slug];
    write({ ...s, been });
  }, []);

  const setQuizDone = useCallback((done: boolean) => write({ ...read(), quizDone: done }), []);

  const rememberResults = useCallback((path: string) => write({ ...read(), lastResults: path }), []);

  const recordGo = useCallback((slug: string) => {
    const s = read();
    write({ ...s, goCount: { ...s.goCount, [slug]: (s.goCount[slug] ?? 0) + 1 } });
  }, []);

  return { state, toggleSaved, markBeen, clearBeen, setQuizDone, rememberResults, recordGo };
}
