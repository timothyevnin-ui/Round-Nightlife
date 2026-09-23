import "server-only";
import { neighborhoodAt } from "./shapes";
import type { NeighborhoodId } from "./types";

/**
 * Anywhere in the city → a point. An exact address, a cross street, a
 * restaurant that isn't on ROUND, a park, a subway stop. One geocoder for
 * Near me, Just say it and the Studio, so they all understand the same
 * things the same way.
 *
 * OpenStreetMap's Nominatim by default (free; asks for one request a second
 * and a User-Agent, both honored here). `ROUND_GEOCODER_URL` swaps in a
 * Nominatim-compatible service when volume grows (LocationIQ's /v1/search
 * works as-is; put its key in `ROUND_GEOCODER_KEY`). Answers are cached for
 * a day so the same corner never costs two lookups.
 */

export type GeoHit = { lat: number; lng: number; label: string; neighborhood: NeighborhoodId | null };

// west, south, east, north: Manhattan below ~96th plus north Brooklyn, with room to spare.
const NYC_BOX = { west: -74.05, south: 40.68, east: -73.9, north: 40.82 };
const CACHE_TTL = 24 * 3600e3;
const cache = new Map<string, { at: number; hit: GeoHit | null }>();
let chain: Promise<unknown> = Promise.resolve();
let last = 0;

export function inNYC(lat: number, lng: number): boolean {
  return lat >= NYC_BOX.south && lat <= NYC_BOX.north && lng >= NYC_BOX.west && lng <= NYC_BOX.east;
}

/** "Rubirosa, Nolita" from "Rubirosa, 235, Mulberry Street, Nolita, Manhattan, New York, …". */
function shortLabel(display: string, q: string): string {
  const parts = display.split(",").map((s) => s.trim()).filter(Boolean);
  // OSM puts the house number in its own part ("Wogies, 39, Greenwich Avenue, …" or "34, East 4th Street, …"): fold it into the street.
  if (parts.length >= 3 && /^\d+[a-z]?$/i.test(parts[1])) parts.splice(1, 2, `${parts[1]} ${parts[2]}`);
  else if (parts.length >= 2 && /^\d+[a-z]?$/i.test(parts[0])) parts.splice(0, 2, `${parts[0]} ${parts[1]}`);
  const label = parts.slice(0, 2).join(", ");
  return (label || q).slice(0, 60);
}

/** Does the text look like a street address ("34 E 4th St", "151 Bleecker Street")? */
export function looksLikeAddress(q: string): boolean {
  return /\b\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'-]+\s+){0,3}(st|street|ave|avenue|av|blvd|boulevard|pl|place|rd|road|broadway|bowery|sq|square|ln|lane|pkwy|parkway|dr|drive)\b\.?/i.test(q);
}

// The whole city, for the Studio (a place in Astoria or on the Upper West Side still gets a pin).
const CITY_BOX = { west: -74.27, south: 40.49, east: -73.68, north: 40.92 };

export async function geocode(raw: string, opts: { anywhere?: boolean } = {}): Promise<GeoHit | null> {
  const q = raw.replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < 3) return null;
  const box = opts.anywhere ? CITY_BOX : NYC_BOX;
  const key = `${opts.anywhere ? "city:" : ""}${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.hit;

  const base = process.env.ROUND_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";
  const url = new URL(base);
  url.searchParams.set("q", /new york|brooklyn|manhattan|\bny\b|nyc/i.test(q) ? q : `${q}, New York, NY`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
  url.searchParams.set("viewbox", `${box.west},${box.south},${box.east},${box.north}`);
  url.searchParams.set("bounded", "1");
  if (process.env.ROUND_GEOCODER_KEY) url.searchParams.set("key", process.env.ROUND_GEOCODER_KEY);

  // One request a second, in order, whoever asks.
  const run = chain.then(async () => {
    const wait = 1100 - (Date.now() - last);
    if (wait > 0 && !process.env.ROUND_GEOCODER_URL) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": `ROUND (${process.env.NEXT_PUBLIC_SITE_URL ?? "round-nightlife.vercel.app"})`, "Accept-Language": "en" }, cache: "no-store" });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    for (const r of rows) {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < box.south || lat > box.north || lng < box.west || lng > box.east) continue;
      return { lat, lng, label: shortLabel(r.display_name ?? "", q), neighborhood: neighborhoodAt(lat, lng) } as GeoHit;
    }
    return null;
  });
  chain = run.catch(() => undefined);
  try {
    const out = await run;
    cache.set(key, { at: Date.now(), hit: out });
    if (cache.size > 800) for (const k of [...cache.keys()].slice(0, 200)) cache.delete(k);
    return out;
  } catch {
    return null;
  }
}
