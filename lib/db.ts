import { cache } from "react";
import { SEED_VENUES } from "./venues";
import { emptyAttrs, clamp01 } from "./normalize";
import { ATTR_KEYS, deriveDaytime } from "./attrs";
import { isNeighborhoodId } from "./neighborhoods";
import type { Attrs, Capacity, Hours, NeighborhoodId, Venue, VenueLocation, VenuePhoto, Window } from "./types";
import { cleanHours } from "./hours";
import { getSettings } from "./settings";

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
export function keyHeaders(key: string): Record<string, string> {
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
  photo_credit?: string | null;
  friends_been: number | null;
  perk: string | null;
  group_booking: Venue["groupBooking"] | null;
  verified: boolean;
  retired?: boolean | null;
  notes: string | null;
  sources: string[] | null;
  hot: boolean | null;
  hot_rank: number | null;
  story: string | null;
  hours?: Hours | null;
  bar_food?: boolean | null;
  cuisine?: string | null;
  score?: number | null;
  day_deal?: string | null;
  photos?: VenuePhoto[] | null;
  locations?: VenueLocation[] | null;
  bar_later?: boolean | null;
  bar_from?: number | null;
};

/** Clean a photos column: real https URLs only, cover first. */
export function cleanPhotos(x: unknown): VenuePhoto[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: VenuePhoto[] = [];
  for (const p of x) {
    if (!p || typeof p !== "object") continue;
    const o = p as { url?: unknown; credit?: unknown };
    if (typeof o.url !== "string" || !/^https?:\/\//.test(o.url.trim())) continue;
    const credit = typeof o.credit === "string" && o.credit.trim() ? o.credit.trim().slice(0, 160) : undefined;
    out.push(credit ? { url: o.url.trim(), credit } : { url: o.url.trim() });
    if (out.length >= 12) break;
  }
  return out.length ? out : undefined;
}

/** Clean a locations column: a real address with coordinates in a neighborhood ROUND covers. */
export function cleanLocations(x: unknown): VenueLocation[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: VenueLocation[] = [];
  for (const l of x) {
    if (!l || typeof l !== "object") continue;
    const o = l as { address?: unknown; lat?: unknown; lng?: unknown; neighborhood?: unknown; label?: unknown };
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    const hood = typeof o.neighborhood === "string" ? o.neighborhood : "";
    if (typeof o.address !== "string" || !o.address.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || !isNeighborhoodId(hood)) continue;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 60) : undefined;
    out.push({ address: o.address.trim().slice(0, 160), lat, lng, neighborhood: hood as NeighborhoodId, ...(label ? { label } : {}) });
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

const CAPACITIES: Capacity[] = ["tiny", "small", "medium", "large"];
const DEFAULT_PHOTO = { from: "#1f2a3a", to: "#4a5a6e", angle: 180 };

export function rowToVenue(r: VenueRow): Venue | null {
  if (!r.slug || !r.name || !isNeighborhoodId(r.neighborhood)) return null;
  const attrs = emptyAttrs();
  for (const k of ATTR_KEYS) attrs[k] = clamp01(r.attrs?.[k], 0);
  // Rows saved before "daytime" existed: read it off what's there.
  if (typeof r.attrs?.daytime !== "number") attrs.daytime = deriveDaytime(attrs);
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
    photoUrl: r.photo_url ?? cleanPhotos(r.photos)?.[0]?.url ?? undefined,
    photoCredit: r.photo_credit ?? cleanPhotos(r.photos)?.[0]?.credit ?? undefined,
    photos: cleanPhotos(r.photos),
    locations: cleanLocations(r.locations),
    barLater: !!r.bar_later,
    barFrom: typeof r.bar_from === "number" && r.bar_from >= 12 && r.bar_from <= 28 ? r.bar_from : undefined,
    friendsBeen: r.friends_been ?? undefined,
    perk: r.perk ?? undefined,
    groupBooking: r.group_booking ?? undefined,
    verified: !!r.verified,
    retired: !!r.retired,
    notes: r.notes ?? undefined,
    sources: r.sources ?? undefined,
    hot: !!r.hot,
    hotRank: typeof r.hot_rank === "number" ? r.hot_rank : undefined,
    story: r.story ?? undefined,
    score: typeof r.score === "number" && r.score >= 0 && r.score <= 100 ? Math.round(r.score) : undefined,
    dayDeal: typeof r.day_deal === "string" && r.day_deal.trim() ? r.day_deal.trim().slice(0, 120) : undefined,
    hours: cleanHours(r.hours),
    barFood: !!r.bar_food,
    cuisine: typeof r.cuisine === "string" && r.cuisine.trim() ? r.cuisine.trim().slice(0, 40) : undefined,
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
    photo_credit: v.photoCredit ?? null,
    photos: v.photos ?? null,
    locations: v.locations ?? null,
    bar_later: !!v.barLater,
    bar_from: v.barLater ? v.barFrom ?? null : null,
    friends_been: v.friendsBeen ?? 0,
    perk: v.perk ?? null,
    group_booking: v.groupBooking ?? null,
    verified: v.verified,
    retired: !!v.retired,
    notes: v.notes ?? null,
    sources: v.sources ?? null,
    hot: !!v.hot,
    hot_rank: v.hotRank ?? null,
    story: v.story ?? null,
    score: typeof v.score === "number" ? v.score : null,
    day_deal: v.dayDeal ?? null,
    hours: v.hours ?? null,
    bar_food: !!v.barFood,
    cuisine: v.cuisine ?? null,
  };
}

/* ───────────────────────── reads ───────────────────────── */

async function fetchRows(fresh = false): Promise<VenueRow[] | null> {
  const { url, anon, configured } = dbConfig();
  if (!configured) return null;
  try {
    const res = await fetch(`${url}/rest/v1/venues?select=*&order=name.asc`, {
      headers: keyHeaders(anon!),
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 60, tags: [VENUES_TAG] } }),
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
    return { venues: withNewSeed(venues), source: "db", dbCount: rows.length };
  }
  return { venues: SEED_VENUES, source: "seed", dbCount: rows ? 0 : -1 };
});

/**
 * Places added to the built-in list after the database was seeded show up
 * straight away (the database's own rows always win); "Sync the built-in
 * list" in Studio turns them into rows you can edit.
 */
function withNewSeed(fromDb: Venue[]): Venue[] {
  const have = new Set(fromDb.map((v) => v.slug));
  const fresh = SEED_VENUES.filter((v) => !have.has(v.slug));
  return fresh.length ? [...fromDb, ...fresh] : fromDb;
}

/**
 * What the app shows. With the verified-only switch on (the default), that's
 * only the places someone from ROUND has been: results, search, the shelf,
 * the maps and the picker's catalog all read from here. A place ROUND passed
 * on ("not for ROUND") never shows, switch or no switch. The Studio reads
 * everything (getVenuesFresh / getVenuesWithSource).
 */
export async function getVenues(): Promise<Venue[]> {
  const { venues } = await getVenuesWithSource();
  const { verifiedOnly } = await getSettings();
  return venues.filter((v) => !v.retired && (!verifiedOnly || v.verified));
}

/** Every place, verified or not (never the passed-on ones): for a venue page reached by its link, and for the Studio's lists. */
export async function getAllVenues(): Promise<Venue[]> {
  return (await getVenuesWithSource()).venues.filter((v) => !v.retired);
}

/**
 * Straight from the database, no cache: what the back office reads before it
 * writes, so a save never works from a minute-old picture (or misses an edit
 * made in Supabase's own table editor).
 */
export async function getVenuesFresh(): Promise<{ venues: Venue[]; source: VenueSource }> {
  const rows = await fetchRows(true);
  if (rows && rows.length > 0) return { venues: withNewSeed(rows.map(rowToVenue).filter((v): v is Venue => v !== null)), source: "db" };
  return { venues: SEED_VENUES, source: "seed" };
}

/** One place by its slug, passed-on ones included (the editor needs them; the public page 404s those itself). */
export async function getVenue(slug: string): Promise<Venue | undefined> {
  return (await getVenuesWithSource()).venues.find((v) => v.slug === slug);
}

/* ───────────────────────── writes (service role, server only) ───────────────────────── */

export function serviceHeaders() {
  const { url, service } = dbConfig();
  if (!url || !service) throw new Error("Database is not configured for writes (SUPABASE_SECRET_KEY missing).");
  return { url, auth: keyHeaders(service), headers: { ...keyHeaders(service), "Content-Type": "application/json" } };
}

/**
 * Upsert venues. If the database is a schema version behind (a column the code
 * knows about doesn't exist yet), that column is dropped from the payload and
 * the save is retried, so a save never fails just because schema.sql hasn't
 * been re-run. The missing column is named in the server log.
 */
export async function upsertVenues(venues: Venue[]): Promise<number> {
  const { url, headers } = serviceHeaders();
  const rows: Record<string, unknown>[] = venues.map((v) => ({ ...venueToRow(v) }));
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${url}/rest/v1/venues?on_conflict=slug`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (res.ok) return venues.length;
    const text = await res.text();
    const missing = missingColumn(text);
    if (missing && rows.some((r) => missing in r)) {
      console.warn(`[db] venues.${missing} doesn't exist yet; saving without it. Run supabase/schema.sql again.`);
      for (const r of rows) delete r[missing];
      continue;
    }
    throw new Error(`Save failed (${res.status}): ${text}`);
  }
  throw new Error("Save failed: the database is several versions behind. Paste supabase/schema.sql into Supabase's SQL Editor and Run it, then save again.");
}

/** PostgREST's "unknown column" error, e.g. PGRST204 "Could not find the 'story' column of 'venues'". */
export function missingColumn(errorText: string): string | null {
  const m = errorText.match(/Could not find the '([a-z_]+)' column/i) ?? errorText.match(/column "?([a-z_]+)"? (?:of relation "[a-z_]+" )?does not exist/i);
  return m ? m[1] : null;
}

export async function deleteVenue(slug: string): Promise<void> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/venues?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`);
}

/** Upload a photo to the public `photos` bucket; returns its public URL. */
export async function uploadPhoto(slug: string, file: File, n = 0): Promise<string> {
  return uploadPhotoBytes(slug, Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg", n);
}

export async function uploadPhotoBytes(slug: string, bytes: Buffer, contentType: string, n = 0): Promise<string> {
  const { url, auth } = serviceHeaders();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${slug}-${Date.now()}${n ? `-${n}` : ""}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": contentType, "x-upsert": "true" },
    body: new Uint8Array(bytes),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status}): ${await res.text()}`);
  return `${url}/storage/v1/object/public/photos/${path}`;
}
