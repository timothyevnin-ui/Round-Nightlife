"use server";

import { getVenues } from "@/lib/db";
import { matchVenues } from "@/lib/match";
import { neighborhoodName } from "@/lib/neighborhoods";

export type PlaceSuggestion = { slug: string; name: string; where: string; kind: "bar" | "restaurant" };

/**
 * "Favorite bar in the city?" as you type: our places that match, so a
 * favorite that's on ROUND is stored by slug and the picker can read its DNA.
 * Public (anyone signed in can ask); nothing but names comes back.
 */
export async function suggestPlaces(q: string, kind?: "bar" | "restaurant"): Promise<PlaceSuggestion[]> {
  const query = (q ?? "").trim().slice(0, 60);
  if (query.length < 2) return [];
  const venues = (await getVenues()).filter((v) => !kind || v.kind === kind);
  return matchVenues(query, venues, 6).map(({ venue }) => ({ slug: venue.slug, name: venue.name, where: neighborhoodName(venue.neighborhood), kind: venue.kind }));
}
