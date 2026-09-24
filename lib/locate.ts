"use client";

import { parseMe, type Point } from "./where";

/**
 * Where the phone is, when the person has allowed it. Two ways in:
 *
 *   locate("silent")  — only if permission was already granted (no prompt),
 *                       so a flow can quietly know they're in the East Village.
 *   locate("ask")     — the real prompt, from a tap on "Use where I am".
 *
 * A recent fix is kept in sessionStorage for ten minutes so the where step,
 * Spots and Just say it don't each wake the GPS. Nothing leaves the phone
 * except as `me=lat,lng` on a results URL, which is never logged.
 */

const KEY = "round_me";
const FRESH_MS = 10 * 60_000;

export function lastFix(): Point | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { at, me } = JSON.parse(raw) as { at: number; me: string };
    if (Date.now() - at > FRESH_MS) return null;
    return parseMe(me);
  } catch {
    return null;
  }
}

function remember(p: Point) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), me: `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` }));
  } catch {
    /* private mode */
  }
}

async function granted(): Promise<boolean> {
  try {
    if (!("permissions" in navigator)) return false;
    const st = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return st.state === "granted";
  } catch {
    return false;
  }
}

function read(timeout = 8000): Promise<Point | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = parseMe(`${pos.coords.latitude},${pos.coords.longitude}`);
        if (p) remember(p);
        resolve(p);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 120_000 },
    );
  });
}

export async function locate(mode: "silent" | "ask"): Promise<Point | null> {
  const cached = lastFix();
  if (cached) return cached;
  if (mode === "silent" && !(await granted())) return null;
  return read();
}
