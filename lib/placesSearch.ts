import { neighborhoodAt } from "./shapes";
import type { NeighborhoodId } from "./types";

/**
 * Type a bar's name, get the bar (V35). Google's Places Autocomplete (New)
 * knows New York's bars by name, so "red li" offers "The Red Lion · 151
 * Bleecker St" and picking it brings the exact address and pin: nothing is
 * geocoded by guesswork after that. The key stays on the server
 * (`GOOGLE_PLACES_KEY`); the phone talks to /api/places. Without a key,
 * Photon (OpenStreetMap, free) answers instead: fewer bar names, every
 * street address, good enough to launch on.
 *
 * Cost: Google's autocomplete is 10,000 calls a month free, then $2.83 per
 * 1,000; a typed name is four or five calls with the 250ms debounce in
 * PlaceSearch. Place Details (Essentials) is 10,000 free, then $5 per 1,000,
 * one per pick, tied to the same session token.
 */

export type PlaceHit = {
  /** Opaque: pass back to resolvePlace. */
  id: string;
  /** "The Red Lion" or "151 Bleecker St". */
  name: string;
  /** "151 Bleecker St, New York" or "West Village, Manhattan". */
  secondary: string;
  /** A named place (a bar) or a plain address. */
  kind: "place" | "address";
};

export type ResolvedPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood: NeighborhoodId | null;
};

/** The five boroughs, roughly. */
const NYC = { low: { latitude: 40.49, longitude: -74.27 }, high: { latitude: 40.92, longitude: -73.68 } };
/** Where most asks are: bias, not a wall. */
const DOWNTOWN = { latitude: 40.728, longitude: -73.995 };

const BAR_TYPES = new Set(["bar", "night_club", "pub", "wine_bar", "cocktail_bar", "beer_bar", "live_music_venue", "karaoke", "restaurant", "cafe", "coffee_shop", "bar_and_grill", "sports_bar", "dance_hall", "comedy_club", "jazz_club"]);

export function placesProvider(): "google" | "photon" {
  return process.env.GOOGLE_PLACES_KEY ? "google" : "photon";
}

const googleBase = () => (process.env.GOOGLE_PLACES_URL ?? "https://places.googleapis.com").replace(/\/$/, "");

/** Up to six matches for what they've typed so far. */
export async function suggestPlaces(raw: string, session?: string): Promise<PlaceHit[]> {
  const q = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  if (q.length < 2) return [];
  return placesProvider() === "google" ? googleSuggest(q, session) : photonSuggest(q);
}

/** The picked place: its proper name, address and pin. */
export async function resolvePlace(id: string, session?: string): Promise<ResolvedPlace | null> {
  if (id.startsWith("photon:")) return photonResolve(id);
  if (placesProvider() !== "google") return null;
  return googleResolve(id, session);
}

/* ── Google ── */

type GPrediction = { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; types?: string[] } };

async function googleSuggest(q: string, session?: string): Promise<PlaceHit[]> {
  const key = process.env.GOOGLE_PLACES_KEY!;
  const res = await fetch(`${googleBase()}/v1/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input: q,
      locationRestriction: { rectangle: NYC },
      origin: DOWNTOWN,
      includedRegionCodes: ["us"],
      languageCode: "en",
      ...(session ? { sessionToken: session } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    console.warn("[places] google autocomplete", res.status, (await res.text()).slice(0, 200));
    return [];
  }
  const json = (await res.json()) as { suggestions?: GPrediction[] };
  const out: PlaceHit[] = [];
  for (const s of json.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    const name = p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
    if (!name) continue;
    const secondary = (p.structuredFormat?.secondaryText?.text ?? "").replace(/, (NY|New York), USA$/, "").replace(/, USA$/, "");
    const types = p.types ?? [];
    const kind: PlaceHit["kind"] = types.some((t) => BAR_TYPES.has(t) || t === "establishment" || t === "point_of_interest") && !types.includes("street_address") && !types.includes("premise") ? "place" : "address";
    out.push({ id: p.placeId, name, secondary, kind });
    if (out.length >= 6) break;
  }
  return out;
}

async function googleResolve(id: string, session?: string): Promise<ResolvedPlace | null> {
  const key = process.env.GOOGLE_PLACES_KEY!;
  const url = new URL(`${googleBase()}/v1/places/${encodeURIComponent(id)}`);
  if (session) url.searchParams.set("sessionToken", session);
  const res = await fetch(url, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,formattedAddress,shortFormattedAddress,location" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!res.ok) {
    console.warn("[places] google details", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const j = (await res.json()) as { displayName?: { text?: string }; formattedAddress?: string; shortFormattedAddress?: string; location?: { latitude?: number; longitude?: number } };
  const lat = j.location?.latitude;
  const lng = j.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const address = (j.shortFormattedAddress ?? j.formattedAddress ?? "").replace(/, (NY|New York), USA$/, "").replace(/, USA$/, "");
  return { name: j.displayName?.text ?? address, address, lat, lng, neighborhood: neighborhoodAt(lat, lng) };
}

/* ── Photon (OpenStreetMap), the no-key fallback ── */

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; housenumber?: string; street?: string; city?: string; district?: string; osm_key?: string; osm_value?: string } };

const photonBase = () => (process.env.PHOTON_URL ?? "https://photon.komoot.io/api").replace(/\/$/, "");

async function photonSuggest(q: string): Promise<PlaceHit[]> {
  const url = new URL(photonBase() + "/");
  url.searchParams.set("q", q);
  url.searchParams.set("lat", String(DOWNTOWN.latitude));
  url.searchParams.set("lon", String(DOWNTOWN.longitude));
  url.searchParams.set("bbox", `${NYC.low.longitude},${NYC.low.latitude},${NYC.high.longitude},${NYC.high.latitude}`);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  const res = await fetch(url, { headers: { "User-Agent": "ROUND (roundnyc.com)" }, cache: "no-store", signal: AbortSignal.timeout(4000) }).catch(() => null);
  if (!res?.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const out: PlaceHit[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const isPlace = !!p.name && p.osm_key !== "highway" && p.osm_key !== "place";
    const name = isPlace ? p.name! : street || p.name || "";
    if (!name) continue;
    const secondary = [isPlace ? street : null, p.district && p.district !== p.city ? p.district : null, p.city].filter(Boolean).join(", ");
    const address = [street, p.city ?? "New York"].filter(Boolean).join(", ");
    out.push({ id: `photon:${lat.toFixed(6)},${lng.toFixed(6)}|${name}|${address}`, name, secondary, kind: isPlace ? "place" : "address" });
  }
  return out;
}

function photonResolve(id: string): ResolvedPlace | null {
  const m = id.match(/^photon:(-?[\d.]+),(-?[\d.]+)\|([^|]*)\|(.*)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { name: m[3], address: m[4], lat, lng, neighborhood: neighborhoodAt(lat, lng) };
}
