import type { Venue, VenueLocation, VenuePhoto } from "./types";

/**
 * A place can have more than one door (Wogies on Greenwich Ave and on
 * Bleecker), more than one photo, and more than one job (a restaurant that's
 * a real bar after ten). These read those off a venue so the engine, the map
 * and the cards all agree.
 */

export type Door = VenueLocation & { main: boolean };

/** Every door, the venue's own address first. */
type Doored = Pick<Venue, "address" | "lat" | "lng" | "neighborhood"> & { locations?: VenueLocation[] | null };

export function doorsOf(v: Doored): Door[] {
  return [{ address: v.address, lat: v.lat, lng: v.lng, neighborhood: v.neighborhood, main: true }, ...(v.locations ?? []).map((l) => ({ ...l, main: false }))];
}

const M_PER_DEG_LAT = 111_000;
const M_PER_DEG_LNG = 84_300;

/** The door closest to a point. */
export function nearestDoor(v: Doored, p: { lat: number; lng: number }): Door {
  let best: Door | null = null;
  let bestD = Infinity;
  for (const d of doorsOf(v)) {
    const m = Math.hypot((d.lat - p.lat) * M_PER_DEG_LAT, (d.lng - p.lng) * M_PER_DEG_LNG);
    if (m < bestD) {
      bestD = m;
      best = d;
    }
  }
  return best!;
}

/** Default hour a restaurant-and-bar becomes the bar. */
export const BAR_FROM_DEFAULT = 22;

/** Counts as a bar at this hour: a bar always; a restaurant & bar from its bar hour on. */
export function isBarAt(v: Pick<Venue, "kind" | "barLater" | "barFrom">, hour: number): boolean {
  if (v.kind === "bar") return true;
  return !!v.barLater && hour >= (v.barFrom ?? BAR_FROM_DEFAULT);
}

/** Has a bar side at all (for lists and filters that don't know the hour). */
export function hasBar(v: Pick<Venue, "kind" | "barLater">): boolean {
  return v.kind === "bar" || !!v.barLater;
}

/** "Bar", "Bar · kitchen", "Restaurant", "Restaurant & bar". */
export function kindWord(v: Pick<Venue, "kind" | "barFood" | "barLater">): string {
  if (v.kind === "restaurant") return v.barLater ? "Restaurant & bar" : "Restaurant";
  return v.barFood ? "Bar · kitchen" : "Bar";
}

/** Every photo, cover first; falls back to the single photo fields. */
export function photosOf(v: Pick<Venue, "photoUrl" | "photoCredit" | "photos">): VenuePhoto[] {
  if (v.photos?.length) return v.photos;
  return v.photoUrl ? [{ url: v.photoUrl, credit: v.photoCredit }] : [];
}
