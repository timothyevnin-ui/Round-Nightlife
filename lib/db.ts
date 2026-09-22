import { cache } from "react";
import { SEED_VENUES } from "./venues";
import { emptyAttrs, clamp01 } from "./normalize";
import { ATTR_KEYS } from "./attrs";
import { isNeighborhoodId } from "./neighborhoods";
import type { Attrs, Capacity, Venue, Window } from "./types";

/**
 * Venue data. Reads come from Supabase's REST endpoint when it's configured
 * (cached for a minute and tagged so the back office can refresh instantly);
 * otherwise, or if the table is empty, the built-in seed keeps the app alive.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (sb_publishable_…; legacy anon JWT also accepted, as NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   SUPABASE_SECRET_KEY                    (sb_secret_…; legacy service_role JWT also accepted, as SUPABASE_SERVICE_ROLE_KEY) — server-only, for writes
 */

export const VENUES_TAG = "venues";

function env(name: string, ...alts: string[]) {
  for (const n of [name, ...alts]) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function dbConfig() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")?.replace(/\/$/, "");
  const anon = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  return { url, anon, service, configured: !!(url && anon), writable: !!(url && service) };
}

/**
 * Supabase's current keys (sb_publishable_… / sb_secret_…) must be sent on the
 * apikey header only; putting them on Authorization makes the platform try to
 * parse them as a JWT and reject the call. The legacy anon/service_role keys
 * are JWTs and go on both headers.
 */
function keyHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

/* ───────────────────────── row ⇄ venue ───────────────────────── */

export type VenueRow = {
  slug: string;
  name: string;
  kind: "bar" | "restaurant";
  neighborhood: string;
  address: string;
  lat: number | null;
  lng: number | null;
  take: string;
  the_catch: string | null;
  tags: string[] | null;
  attrs: Partial<Attrs> | null;
  group_fit: Venue["groupFit"] | null;
  date_fit: Venue["dateFit"] | null;
  price: number;
  capacity: string;
  best_windows: Window[] | null;
  easy_in: number;
  photo: Venue["photo"] | null;
  photo_url: string | null;
  friends_been: number | null;
  perk: string | null;
  group_booking: Venue["groupBooking"] | null;
  verified: boolean;
  notes: string | null;
  sources: string[] | null;
};

const CAPACITIES: Capacity[] = ["tiny", "small", "medium", "large"];
const DEFAULT_PHOTO = { from: "#161922", to: "#3a4150", angle: 180 };

export function rowToVenue(r: VenueRow): Venue | null {
  if (!r.slug || !r.name || !isNeighborhoodId(r.neighborhood)) return null;
  const attrs = emptyAttrs();
  for (const k of ATTR_KEYS) attrs[k] = clamp01(r.attrs?.[k], 0);
  const price = Math.min(4, Math.max(1, Math.round(Number(r.price) || 2))) as 1 | 2 | 3 | 4;
  return {
    slug: r.slug,
    name: r.name,
    kind: r.kind === "restaurant" ? "restaurant" : "bar",
    neighborhood: r.neighborhood,
    address: r.address ?? "",
    lat: Number(r.lat) || 40.73,
    lng: Number(r.lng) || -73.99,
    take: r.take ?? "",
    theCatch: r.the_catch ?? undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    attrs,
    groupFit: {
      two: clamp01(r.group_fit?.two, 0.7),
      small: clamp01(r.group_fit?.small, 0.7),
      mid: clamp01(r.group_fit?.mid, 0.5),
      big: clamp01(r.group_fit?.big, 0.3),
    },
    dateFit: {
      first: clamp01(r.date_fit?.first, 0.5),
      early: clamp01(r.date_fit?.early, 0.5),
      longterm: clamp01(r.date_fit?.longterm, 0.5),
    },
    price,
    capacity: CAPACITIES.includes(r.capacity as Capacity) ? (r.capacity as Capacity) : "medium",
    bestWindows: Array.isArray(r.best_windows) && r.best_windows.length ? r.best_windows : [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 26 }],
    easyIn: clamp01(r.easy_in, 0.5),
    photo: r.photo && typeof r.photo.from === "string" ? r.photo : DEFAULT_PHOTO,
    photoUrl: r.photo_url ?? undefined,
    friendsBeen: r.friends_been ?? undefined,
    perk: r.perk ?? undefined,
    groupBooking: r.group_booking ?? undefined,
    verified: !!r.verified,
    notes: r.notes ?? undefined,
    sources: r.sources ?? undefined,
  };
}

export function venueToRow(v: Venue): VenueRow {
  return {
    slug: v.slug,
    name: v.name,
    kind: v.kind,
    neighborhood: v.neighborhood,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    take: v.take,
    the_catch: v.theCatch ?? null,
    tags: v.tags,
    attrs: v.attrs,
    group_fit: v.groupFit,
    date_fit: v.dateFit,
    price: v.price,
    capacity: v.capacity,
    best_windows: v.bestWindows,
    easy_in: v.easyIn,
    photo: v.photo,
    photo_url: v.photoUrl ?? null,
    friends_been: v.friendsBeen ?? 0,
    perk: v.perk ?? null,
    group_booking: v.groupBooking ?? null,
    verified: v.verified,
    notes: v.notes ?? null,
    sources: v.sources ?? null,
  };
}

/* ───────────────────────── reads ───────────────────────── */

async function fetchRows(): Promise<VenueRow[] | null> {
  const { url, anon, configured } = dbConfig();
  if (!configured) return null;
  try {
    const res = await fetch(`${url}/rest/v1/venues?select=*&order=name.asc`, {
      headers: keyHeaders(anon!),
      next: { revalidate: 60, tags: [VENUES_TAG] },
    });
    if (!res.ok) {
      console.error("[db] venues fetch failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    return (await res.json()) as VenueRow[];
  } catch (e) {
    console.error("[db] venues fetch error", e);
    return null;
  }
}

export type VenueSource = "db" | "seed";

/** All venues, plus where they came from. Memoized per request. */
export const getVenuesWithSource = cache(async (): Promise<{ venues: Venue[]; source: VenueSource; dbCount: number }> => {
  const rows = await fetchRows();
  if (rows && rows.length > 0) {
    const venues = rows.map(rowToVenue).filter((v): v is Venue => v !== null);
    return { venues, source: "db", dbCount: rows.length };
  }
  return { venues: SEED_VENUES, source: "seed", dbCount: rows ? 0 : -1 };
});

export async function getVenues(): Promise<Venue[]> {
  return (await getVenuesWithSource()).venues;
}

export async function getVenue(slug: string): Promise<Venue | undefined> {
  return (await getVenues()).find((v) => v.slug === slug);
}

/* ───────────────────────── writes (service role, server only) ───────────────────────── */

function serviceHeaders() {
  const { url, service } = dbConfig();
  if (!url || !service) throw new Error("Database is not configured for writes (SUPABASE_SECRET_KEY missing).");
  return { url, auth: keyHeaders(service), headers: { ...keyHeaders(service), "Content-Type": "application/json" } };
}

export async function upsertVenues(venues: Venue[]): Promise<number> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/venues?on_conflict=slug`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(venues.map(venueToRow)),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Save failed (${res.status}): ${await res.text()}`);
  return venues.length;
}

export async function deleteVenue(slug: string): Promise<void> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/venues?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`);
}

/** Upload a photo to the public `photos` bucket; returns its public URL. */
export async function uploadPhoto(slug: string, file: File): Promise<string> {
  const { url, auth } = serviceHeaders();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slug}-${Date.now()}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": file.type || "image/jpeg", "x-upsert": "true" },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status}): ${await res.text()}`);
  return `${url}/storage/v1/object/public/photos/${path}`;
}
