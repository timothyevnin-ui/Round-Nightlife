import { isNeighborhoodId } from "./neighborhoods";
import type { NeighborhoodId, Venue } from "./types";

/**
 * A "plan" is the shareable object: what ROUND suggested, for when, for whom.
 * In V1 it's encoded entirely in the URL (no database needed), so a plan link
 * works forever and renders a proper Open Graph card in iMessage.
 */
export type PlanStop = { restaurant?: string; bar: string; dinnerAt?: number; drinksAt?: number; walk?: number };

export type PlanPayload = {
  m: "night" | "date" | "dinner";
  n: NeighborhoodId;
  t: number; // hour
  /** Day of week, 0..6 (V28: so a shared 1pm plan says Brunch). */
  d?: number;
  g?: number; // group size
  s: PlanStop[];
  /** Index of the stop the user picked (after tapping GO), if any. */
  p?: number;
};

export type Plan = Omit<PlanPayload, "s"> & {
  stops: { restaurant?: Venue; bar: Venue; dinnerAt?: number; drinksAt?: number; walk?: number }[];
};

function toBase64Url(s: string) {
  const b64 = typeof window === "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return typeof window === "undefined"
    ? Buffer.from(b64, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(b64)));
}

export function encodePlan(p: PlanPayload): string {
  return toBase64Url(JSON.stringify(p));
}

export function decodePlan(code: string, venues: Record<string, Venue>): Plan | null {
  try {
    const raw = JSON.parse(fromBase64Url(code)) as PlanPayload;
    if (!raw || (raw.m !== "night" && raw.m !== "date" && raw.m !== "dinner")) return null;
    if (!isNeighborhoodId(raw.n)) return null;
    const stops = (raw.s ?? [])
      .map((s) => {
        const bar = venues[s.bar];
        if (!bar) return null;
        const restaurant = s.restaurant ? venues[s.restaurant] : undefined;
        return { bar, restaurant, dinnerAt: s.dinnerAt, drinksAt: s.drinksAt, walk: s.walk };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (stops.length === 0) return null;
    return { m: raw.m, n: raw.n, t: Number(raw.t) || 21, d: typeof raw.d === "number" ? raw.d : undefined, g: raw.g, p: raw.p, stops };
  } catch {
    return null;
  }
}
