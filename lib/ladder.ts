import type { BeenEntry, RoundState } from "./store";
import type { Venue } from "./types";

/**
 * Your ladder, with numbers (V27). The ladder is an order, not a score: every
 * rating slots a place above or below the ones already there. The number is
 * for reading it at a glance and for sending it: the top of the ladder is a
 * 10, then 0.4 less a rung (never under 6); a place that was only "fine" is a 5, a
 * never-again a 2. One rating alone is a 9.5 if you'd go back tonight, an 8 if
 * you'd go back.
 */

export type Rung = { venue: Venue; entry: BeenEntry; rank: number | null; score: number };

export function scoreAt(index: number, count: number, entry: Pick<BeenEntry, "verdict">): number {
  if (index < 0) return entry.verdict === "never" ? 2 : entry.verdict === "fine" ? 5 : 0;
  if (count <= 1) return entry.verdict === "again" ? 9.5 : 8;
  // 0.4 a rung until the ladder is eleven long; after that the rungs get closer, the bottom stays a 6.
  const spread = Math.min(4, 0.4 * (count - 1));
  return round1(10 - (spread * index) / (count - 1));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** The ladder as rows: rank, score, the place, the words. */
export function rungs(state: Pick<RoundState, "been" | "ladder">, byslug: Record<string, Venue>): Rung[] {
  const order = (state.ladder ?? []).filter((s) => byslug[s] && state.been[s]);
  return order.map((slug, i) => ({ venue: byslug[slug], entry: state.been[slug], rank: i + 1, score: scoreAt(i, order.length, state.been[slug]) }));
}

/** Everything you've been to: the ladder first (with numbers), then the rest newest first. */
export function beenRows(state: Pick<RoundState, "been" | "ladder">, byslug: Record<string, Venue>): Rung[] {
  const ranked = rungs(state, byslug);
  const onLadder = new Set(ranked.map((r) => r.venue.slug));
  const rest = Object.entries(state.been)
    .filter(([slug]) => byslug[slug] && !onLadder.has(slug))
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([slug, entry]) => ({ venue: byslug[slug], entry, rank: null, score: scoreAt(-1, 0, entry) }));
  return [...ranked, ...rest];
}

/** The score as it's shown: "9.2", or "—" when there's no rating yet. */
export function scoreText(score: number): string {
  return score > 0 ? score.toFixed(1) : "—";
}

/** The color of a score: the top of the ladder in tomato, the middle in pine, the rest in ink. */
export function scoreTone(score: number): string {
  if (score >= 9) return "var(--tomato)";
  if (score >= 7) return "var(--pine)";
  if (score > 0) return "var(--ink-55)";
  return "var(--ink-35)";
}

/** "Member since September 2026" from an ISO stamp; nothing when it's missing. */
export function memberSince(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
