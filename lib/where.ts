import { NEIGHBORHOOD_MAP } from "./neighborhoods";
import { SHAPES, type LngLat } from "./shapes";
import type { NeighborhoodId } from "./types";

/**
 * "Where?" is a general area, not a wall.
 *
 * The neighborhood someone taps says roughly where they want to be. A place
 * inside it counts in full; a place a few minutes' walk past its edge is
 * fair game and fades with every minute; past WALK_LIMIT it's out (Chelsea
 * never gets a Lower East Side answer). When we know where the person is
 * standing, the walk is measured from them instead.
 */

/** A brisk New York walk. */
export const WALK_M_PER_MIN = 80;
/** Minutes past the edge of the chosen neighborhood before a place drops out. */
export const WALK_LIMIT = 16;
/** Minutes from the person, when we know where they are, before a place drops out. */
export const WALK_LIMIT_FROM_ME = 20;

export type Point = { lat: number; lng: number };

/** Where the night is anchored: the neighborhood they chose, and where they are if we know it. */
export type Anchor = {
  hood?: NeighborhoodId;
  /** The person's own location, when they allowed it. */
  me?: Point;
};

const M_PER_DEG_LAT = 111_000;
const M_PER_DEG_LNG = 84_300; // at 40.7° N

function toXY(p: LngLat): [number, number] {
  return [p[0] * M_PER_DEG_LNG, p[1] * M_PER_DEG_LAT];
}

function inside(pt: LngLat, poly: LngLat[]): boolean {
  const [x, y] = pt;
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function segmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

/** Meters from a point to the edge of a neighborhood: 0 inside. */
export function metersToNeighborhood(p: Point, hood: NeighborhoodId): number {
  const poly = SHAPES[hood];
  if (!poly) return Math.hypot((p.lat - NEIGHBORHOOD_MAP[hood].center.lat) * M_PER_DEG_LAT, (p.lng - NEIGHBORHOOD_MAP[hood].center.lng) * M_PER_DEG_LNG);
  const pt: LngLat = [p.lng, p.lat];
  if (inside(pt, poly)) return 0;
  const xy = toXY(pt);
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, segmentDistance(xy, toXY(poly[i]), toXY(poly[j])));
  return best;
}

export function metersBetween(a: Point, b: Point): number {
  return Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lng - b.lng) * M_PER_DEG_LNG);
}

export const walkMinutes = (meters: number) => Math.max(0, Math.round(meters / WALK_M_PER_MIN));

/** Is the person close enough to the neighborhood they chose that their own spot should anchor the night? */
export function isNearby(me: Point, hood: NeighborhoodId): boolean {
  return metersToNeighborhood(me, hood) <= 5 * WALK_M_PER_MIN;
}

export type WhereRead = {
  /** 0..1, how well the place answers "where?". */
  where: number;
  /** Minutes of walking past the chosen neighborhood's edge (0 inside), or from the person when the night is anchored on them. */
  walk: number;
  /** In the neighborhood they tapped. */
  inHood: boolean;
  /** The walk is measured from the person, not the neighborhood. */
  fromMe: boolean;
};

/**
 * How a place reads against the anchor. Null when it's too far to offer.
 *
 * Anchored on a neighborhood: 1 inside; just past the edge 0.92, then down
 * to about 0.3 at WALK_LIMIT. Anchored on the person (they're in or right by
 * the neighborhood they chose, or they never chose one): 1 next door, fading
 * to 0.3 at WALK_LIMIT_FROM_ME, with a small nod to the neighborhood they
 * tapped so it still means something.
 */
export function whereRead(venue: Point & { neighborhood: NeighborhoodId }, anchor: Anchor): WhereRead | null {
  const inHood = !!anchor.hood && venue.neighborhood === anchor.hood;
  const fromMe = !!anchor.me && (!anchor.hood || isNearby(anchor.me, anchor.hood));
  if (fromMe && anchor.me) {
    const walk = walkMinutes(metersBetween(anchor.me, venue));
    if (walk > WALK_LIMIT_FROM_ME) return null;
    const where = Math.min(1, 1 - 0.7 * (walk / WALK_LIMIT_FROM_ME) + (inHood ? 0.04 : 0));
    return { where, walk, inHood, fromMe: true };
  }
  if (!anchor.hood) return { where: 0.5, walk: 0, inHood: false, fromMe: false };
  if (inHood) return { where: 1, walk: 0, inHood: true, fromMe: false };
  const walk = walkMinutes(metersToNeighborhood(venue, anchor.hood));
  if (walk > WALK_LIMIT) return null;
  return { where: 0.92 - 0.62 * (walk / WALK_LIMIT), walk, inHood: false, fromMe: false };
}

/** "lat,lng" from a URL → a point in or around Manhattan, or null. */
export function parseMe(raw: string | undefined | null): Point | null {
  if (!raw) return null;
  const [a, b] = raw.split(",").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 40.55 || a > 40.9 || b < -74.1 || b > -73.7) return null;
  return { lat: a, lng: b };
}

export const formatMe = (p: Point) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
