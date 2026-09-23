import type { Venue } from "./types";

/** The "What's hot right now" shelf, in order. */
export function hotVenues(venues: Venue[]): Venue[] {
  return venues.filter((v) => v.hot).sort((a, b) => (a.hotRank ?? 99) - (b.hotRank ?? 99) || a.name.localeCompare(b.name));
}

/** Story text → paragraphs (blank-line separated). */
export function storyParagraphs(story: string | undefined): string[] {
  return (story ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
