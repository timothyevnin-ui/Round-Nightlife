import { NEIGHBORHOOD_MAP, neighborhoodName } from "./neighborhoods";
import type { NeighborhoodId } from "./types";
import { neighborhoodAt } from "./shapes";
import { metersToNeighborhood, walkMinutes } from "./where";
import type { Venue } from "./types";

/**
 * Pins that can't be right (V35). A place's pin should sit in the
 * neighborhood it's filed under; one that's missing, in another of ROUND's
 * neighborhoods, or a long walk outside its own was geocoded to the wrong
 * corner of the city, and every walk time on every card lies until it's
 * fixed. The dashboard names them; the place's page has the map.
 */
export type PinProblem = {
  slug: string;
  name: string;
  neighborhood: NeighborhoodId;
  reason: "missing" | "elsewhere" | "far";
  /** Where the pin actually sits, when it's one of ours. */
  at?: NeighborhoodId;
  /** Minutes' walk from the edge of its own neighborhood. */
  walk?: number;
};

/** More than this far outside its neighborhood's edge, and the pin is wrong, not just on the border. */
const FAR_M = 900;

export function pinProblems(venues: Pick<Venue, "slug" | "name" | "neighborhood" | "lat" | "lng">[]): PinProblem[] {
  const out: PinProblem[] = [];
  for (const v of venues) {
    if (!NEIGHBORHOOD_MAP[v.neighborhood]) continue;
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || !Number.isFinite(v.lat) || !Number.isFinite(v.lng) || (v.lat === 0 && v.lng === 0)) {
      out.push({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, reason: "missing" });
      continue;
    }
    const m = metersToNeighborhood({ lat: v.lat, lng: v.lng }, v.neighborhood);
    if (m === 0) continue;
    const at = neighborhoodAt(v.lat, v.lng);
    if (at && at !== v.neighborhood && metersToNeighborhood({ lat: v.lat, lng: v.lng }, at) === 0) {
      out.push({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, reason: "elsewhere", at, walk: walkMinutes(m) });
      continue;
    }
    if (m > FAR_M) out.push({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, reason: "far", walk: walkMinutes(m) });
  }
  return out.sort((a, b) => (b.walk ?? 999) - (a.walk ?? 999));
}

export function pinProblemWords(p: PinProblem): string {
  if (p.reason === "missing") return "no pin at all";
  if (p.reason === "elsewhere") return `filed under ${neighborhoodName(p.neighborhood)}, pinned in ${neighborhoodName(p.at!)}`;
  return `pinned ${p.walk} min outside ${neighborhoodName(p.neighborhood)}`;
}
