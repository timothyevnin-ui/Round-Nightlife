import type { Venue } from "./types";

/**
 * Ranked by New York (V33): ROUND's score and the people's number, side by
 * side, into one order. A place with both is ranked on their average; with
 * only ROUND's score, on that; the people's number alone needs three
 * ratings (it isn't there before). Ties go to the place more people rated.
 */
export type Ranked = { venue: Venue; rank: number; round?: number; people?: number; n: number; value: number };

export function rankValue(v: Venue): number | null {
  const round = typeof v.score === "number" ? v.score : null;
  const people = typeof v.crowd?.people === "number" ? v.crowd.people : null;
  if (round !== null && people !== null) return (round + people) / 2;
  if (round !== null) return round;
  if (people !== null) return people;
  return null;
}

export function rankVenues(venues: Venue[], limit = 50): Ranked[] {
  return venues
    .map((venue) => ({ venue, value: rankValue(venue), n: venue.crowd?.n ?? 0 }))
    .filter((r): r is { venue: Venue; value: number; n: number } => r.value !== null)
    .sort((a, b) => b.value - a.value || b.n - a.n || a.venue.name.localeCompare(b.venue.name))
    .slice(0, limit)
    .map((r, i) => ({ venue: r.venue, rank: i + 1, round: r.venue.score, people: r.venue.crowd?.people, n: r.n, value: r.value }));
}

/** How many people have rated anything in this set. */
export function ratersOf(venues: Venue[]): number {
  return venues.reduce((t, v) => t + (v.crowd?.n ?? 0), 0);
}
