"use client";

import { useSyncExternalStore } from "react";
import { DAY_NAMES, formatHour, nowInNYC } from "./time";

/**
 * "When" as a setting, not a step. The chip on Home ("It's Wednesday ·
 * 3:40pm") sets a planned time and day that every flow, Just say it and
 * Near me then use as their default. It forgets itself after a few hours,
 * so tomorrow starts from now again.
 */

export type When = { hour: number; dow: number; setAt: number };
const KEY = "round:when";
const TTL_MS = 6 * 3600e3;
const listeners = new Set<() => void>();
let cache: When | null | undefined;

function read(): When | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const w = raw ? (JSON.parse(raw) as When) : null;
    cache = w && Date.now() - w.setAt < TTL_MS && Number.isFinite(w.hour) ? w : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function setWhen(w: { hour: number; dow: number } | null) {
  cache = w ? { ...w, setAt: Date.now() } : null;
  try {
    if (cache) window.localStorage.setItem(KEY, JSON.stringify(cache));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The planned time, or null when it's just "now". */
export function useWhen(): When | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Right now, in ROUND's terms: hour (24+ after midnight) and the night's day-of-week. */
export function nowWhen(): { hour: number; dow: number } {
  const { hour, minute, dow } = nowInNYC();
  const h = hour < 5 ? hour + 24 + minute / 60 : hour + minute / 60;
  return { hour: Math.round(h * 4) / 4, dow: hour < 5 ? (dow + 6) % 7 : dow };
}

/** What the flows should start from: the planned time if there is one, otherwise the phone's clock right now. */
export function effectiveWhen(): { hour: number; dow: number; planned: boolean } {
  const w = read();
  if (w) return { hour: w.hour, dow: w.dow, planned: true };
  return { ...nowWhen(), planned: false };
}

export const isDayHour = (h: number) => h >= 5 && h < 17;

/** "Saturday · 2pm", "Tonight · 9pm", "Now" */
export function whenLabel(w: When | null): string {
  if (!w) return "Now";
  const today = nowWhen().dow;
  const day = w.dow === today ? (isDayHour(w.hour) ? "Today" : "Tonight") : w.dow === (today + 1) % 7 ? "Tomorrow" : DAY_NAMES[w.dow];
  return `${day} · ${formatHour(w.hour, true)}`;
}
