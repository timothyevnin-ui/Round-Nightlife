"use server";

import Anthropic from "@anthropic-ai/sdk";
import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminPin, isAdmin, pinMatches, signPin } from "@/lib/adminAuth";
import { ATTR_KEYS, ATTR_LIST } from "@/lib/attrs";
import { dbConfig, deleteVenue as dbDelete, getVenuesFresh, upsertVenues, uploadPhoto, uploadPhotoBytes, VENUES_TAG } from "@/lib/db";
import { fetchCommonsBytes, searchCommons, type CommonsPhoto } from "@/lib/commons";
import { isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { clamp01, emptyAttrs } from "@/lib/normalize";
import { SEED_VENUES } from "@/lib/venues";
import type { Attrs, Capacity, Venue, Window } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { setSuggestionStatus, type SuggestionStatus } from "@/lib/suggestions";

/* ───────────────────────── auth ───────────────────────── */

export async function login(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const pin = String(formData.get("pin") ?? "");
  if (!adminPin()) return { error: "ROUND_ADMIN_PIN isn't set on the server yet." };
  if (!pinMatches(pin)) return { error: "That's not it." };
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, signPin(adminPin()!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

async function guard() {
  if (!(await isAdmin())) throw new Error("Not signed in.");
}

/* ───────────────────────── venues ───────────────────────── */

export type SavePayload = {
  slug?: string;
  originalSlug?: string;
  name: string;
  kind: "bar" | "restaurant";
  neighborhood: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  take: string;
  theCatch?: string;
  notes?: string;
  tags: string[];
  attrs: Partial<Attrs>;
  groupFit: Venue["groupFit"];
  dateFit: Venue["dateFit"];
  price: number;
  capacity: Capacity;
  easyIn: number;
  bestWindows: Window[];
  verified: boolean;
  friendsBeen?: number;
  photoUrl?: string;
  perk?: string;
  hot?: boolean;
  hotRank?: number | null;
  story?: string;
  photoCredit?: string;
  /** Set when the place is being added from a recommendation; marks it "added" on save. */
  suggestionId?: string;
};

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

export async function saveVenue(formData: FormData): Promise<SaveResult> {
  try {
    await guard();
    const raw = formData.get("payload");
    if (typeof raw !== "string") return { ok: false, error: "Nothing to save." };
    const p = JSON.parse(raw) as SavePayload;
    if (!p.name?.trim()) return { ok: false, error: "Give it a name." };
    if (!isNeighborhoodId(p.neighborhood)) return { ok: false, error: "Pick a neighborhood." };

    const slug = (p.slug?.trim() || slugify(p.name)).replace(/[^a-z0-9-]/g, "") || `place-${Date.now()}`;
    const existing = (await getVenuesFresh()).venues.find((v) => v.slug === (p.originalSlug || slug));

    const attrs: Attrs = emptyAttrs();
    for (const k of ATTR_KEYS) attrs[k] = clamp01(p.attrs?.[k], existing?.attrs[k] ?? 0);

    let photoUrl = p.photoUrl?.trim() || existing?.photoUrl;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > 8 * 1024 * 1024) return { ok: false, error: "Photo is over 8 MB. Pick a smaller one." };
      photoUrl = await uploadPhoto(slug, photo);
    }

    const venue: Venue = {
      slug,
      name: p.name.trim(),
      kind: p.kind === "restaurant" ? "restaurant" : "bar",
      neighborhood: p.neighborhood,
      address: (p.address ?? "").trim(),
      lat: typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : existing?.lat ?? 40.73,
      lng: typeof p.lng === "number" && Number.isFinite(p.lng) ? p.lng : existing?.lng ?? -73.99,
      take: (p.take ?? "").trim(),
      theCatch: p.theCatch?.trim() || undefined,
      notes: p.notes?.trim() || undefined,
      tags: (p.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      attrs,
      groupFit: {
        two: clamp01(p.groupFit?.two, 0.7),
        small: clamp01(p.groupFit?.small, 0.7),
        mid: clamp01(p.groupFit?.mid, 0.5),
        big: clamp01(p.groupFit?.big, 0.3),
      },
      dateFit: {
        first: clamp01(p.dateFit?.first, 0.5),
        early: clamp01(p.dateFit?.early, 0.5),
        longterm: clamp01(p.dateFit?.longterm, 0.5),
      },
      price: (Math.min(4, Math.max(1, Math.round(Number(p.price) || 2))) as 1 | 2 | 3 | 4),
      capacity: (["tiny", "small", "medium", "large"] as Capacity[]).includes(p.capacity) ? p.capacity : "medium",
      easyIn: clamp01(p.easyIn, 0.5),
      bestWindows: Array.isArray(p.bestWindows) && p.bestWindows.length ? p.bestWindows : existing?.bestWindows ?? [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 26 }],
      photo: existing?.photo ?? pickGradient(slug),
      photoUrl,
      photoCredit: photoUrl && !(photo instanceof File && photo.size > 0) ? p.photoCredit?.trim() || undefined : undefined,
      friendsBeen: Number.isFinite(Number(p.friendsBeen)) ? Number(p.friendsBeen) : existing?.friendsBeen,
      perk: p.perk?.trim() || existing?.perk,
      groupBooking: existing?.groupBooking,
      verified: !!p.verified,
      sources: existing?.sources,
      hot: !!p.hot,
      hotRank: Number.isFinite(Number(p.hotRank)) && p.hotRank !== null && p.hotRank !== undefined ? Number(p.hotRank) : undefined,
      story: p.story?.trim() || undefined,
    };

    await upsertVenues([venue]);
    if (p.originalSlug && p.originalSlug !== slug) await dbDelete(p.originalSlug);
    updateTag(VENUES_TAG);
    if (p.suggestionId) await setSuggestionStatus(p.suggestionId, "added", slug).catch((e) => console.warn("[admin] couldn't mark the suggestion", e));
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function removeVenue(slug: string): Promise<SaveResult> {
  try {
    await guard();
    await dbDelete(slug);
    updateTag(VENUES_TAG);
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}

/** One-time: copy the 68 seed venues into the database. Safe to re-run (upsert). */
export async function importSeed(): Promise<SaveResult> {
  try {
    await guard();
    const n = await upsertVenues(SEED_VENUES);
    updateTag(VENUES_TAG);
    return { ok: true, slug: String(n) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}

/**
 * Bring the database up to date with ROUND's built-in list (the researched
 * places). New slugs are added. Places that exist but aren't verified get the
 * list's facts and traits refreshed, keeping anything the back office owns:
 * photos, credit, the shelf, the story, regulars, perks, verified. Verified
 * places are never touched. Nothing is ever deleted.
 */
export async function syncSeed(): Promise<{ ok: true; added: number; refreshed: number; kept: number; missing: string[] } | { ok: false; error: string }> {
  try {
    await guard();
    const { venues: current, source } = await getVenuesFresh();
    if (source !== "db") {
      const n = await upsertVenues(SEED_VENUES);
      updateTag(VENUES_TAG);
      return { ok: true, added: n, refreshed: 0, kept: 0, missing: [] };
    }
    const bySlug = new Map(current.map((v) => [v.slug, v]));
    const writes: Venue[] = [];
    let added = 0;
    let refreshed = 0;
    let kept = 0;
    for (const seed of SEED_VENUES) {
      const db = bySlug.get(seed.slug);
      if (!db) {
        writes.push(seed);
        added++;
        continue;
      }
      if (db.verified) {
        kept++;
        continue;
      }
      writes.push({
        ...seed,
        photo: db.photo,
        photoUrl: db.photoUrl,
        photoCredit: db.photoCredit,
        hot: db.hot,
        hotRank: db.hotRank,
        story: db.story ?? seed.story,
        friendsBeen: db.friendsBeen ?? seed.friendsBeen,
        perk: db.perk,
        groupBooking: db.groupBooking,
        verified: false,
        notes: db.notes && db.notes !== seed.notes ? [db.notes, seed.notes].filter(Boolean).join("\n\n") : seed.notes,
      });
      refreshed++;
    }
    for (let i = 0; i < writes.length; i += 50) await upsertVenues(writes.slice(i, i + 50));
    const seedSlugs = new Set(SEED_VENUES.map((v) => v.slug));
    const missing = current.filter((v) => !seedSlugs.has(v.slug)).map((v) => v.name);
    updateTag(VENUES_TAG);
    return { ok: true, added, refreshed, kept, missing };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

/**
 * Put the six starter stories on the shelf. Only touches places that exist in
 * the database and have no story yet, so a rewritten story is never clobbered.
 */
export async function importStories(): Promise<SaveResult> {
  try {
    await guard();
    const { SEED_STORIES } = await import("@/lib/stories");
    const { venues: current } = await getVenuesFresh();
    const updates: Venue[] = [];
    for (const v of current) {
      const seed = SEED_STORIES[v.slug];
      if (!seed || v.story) continue;
      updates.push({ ...v, hot: true, hotRank: seed.rank, story: seed.story });
    }
    if (updates.length) await upsertVenues(updates);
    updateTag(VENUES_TAG);
    return { ok: true, slug: String(updates.length) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}

/* ───────────────────────── helpers ───────────────────────── */

const GRADIENTS = [
  { from: "#16213a", to: "#2e4470", angle: 160 },
  { from: "#2b1d0c", to: "#8a6320", angle: 170 },
  { from: "#2a0f1c", to: "#7a2444", angle: 150 },
  { from: "#0c2419", to: "#1f5a3f", angle: 165 },
  { from: "#161922", to: "#3a4150", angle: 180 },
  { from: "#3a1a2a", to: "#8a3f5a", angle: 155 },
  { from: "#0e2a3a", to: "#1f6a8a", angle: 175 },
  { from: "#1c160a", to: "#6b5a1e", angle: 160 },
  { from: "#1c1030", to: "#4a2a7a", angle: 165 },
];
function pickGradient(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Address → coordinates via OpenStreetMap's Nominatim (free, low volume, back office only). */
export async function lookupAddress(address: string): Promise<{ lat: number; lng: number; label: string } | { error: string }> {
  try {
    await guard();
    const q = address.trim();
    if (!q) return { error: "Type an address first." };
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + (/new york|brooklyn|ny\b/i.test(q) ? "" : ", New York, NY"))}`, {
      headers: { "User-Agent": "ROUND back office (nightlife app; contact via site)" },
      cache: "no-store",
    });
    if (!res.ok) return { error: `Lookup failed (${res.status}).` };
    const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!json[0]) return { error: "Couldn't find that address." };
    return { lat: Number(json[0].lat), lng: Number(json[0].lon), label: json[0].display_name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Lookup failed." };
  }
}

/** Draft a Take and a catch in ROUND's voice from the founder's notes. Needs ANTHROPIC_API_KEY. */
export async function draftTake(input: { name: string; neighborhood: string; kind: string; notes: string; tags: string[]; attrs: Partial<Attrs> }): Promise<{ take?: string; theCatch?: string; error?: string }> {
  try {
    await guard();
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { error: "Add ANTHROPIC_API_KEY to the deployment to draft with AI." };
    const strong = ATTR_LIST.filter((a) => (input.attrs[a.key] ?? 0) >= 0.7).map((a) => a.label);
    const weak = ATTR_LIST.filter((a) => (input.attrs[a.key] ?? 0) <= 0.15).map((a) => a.label);
    const client = new Anthropic({ apiKey: key });
    const hood = isNeighborhoodId(input.neighborhood) ? neighborhoodName(input.neighborhood) : input.neighborhood;
    const res = await client.messages.create({
      model: process.env.ROUND_TEXT_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "You write for ROUND, a nightlife recommendation app in NYC. Voice: editorial, confident, dry, specific, warm. Never generic, never marketing, never exclamation points. " +
        "Sound like a friend with taste who has actually been there. One sentence for the Take (max 28 words). One sentence for the catch (max 22 words): the practical thing Maps doesn't know (lines, when to arrive, what to order, what to avoid). " +
        "Use only the facts given. Do not invent hours, prices, awards, or history. If the notes don't support a catch, return an empty string for it. Respond with JSON only: {\"take\": string, \"theCatch\": string}.",
      messages: [
        {
          role: "user",
          content:
            `Place: ${input.name} (${input.kind}) in ${hood}.\n` +
            `Tags: ${input.tags.join(", ") || "none"}.\n` +
            `Strong traits: ${strong.join(", ") || "none"}.\n` +
            `Not really: ${weak.join(", ") || "none"}.\n` +
            `Founder's notes: """${input.notes || "(none)"}"""`,
        },
      ],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { take?: string; theCatch?: string };
    return { take: (json.take ?? "").trim(), theCatch: (json.theCatch ?? "").trim() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draft failed." };
  }
}

/* ───────────────────────── photos from Wikimedia Commons ───────────────────────── */

/** Free-license photos of a place. Only the famous ones tend to be there. */
export async function findPhotos(query: string): Promise<{ photos: CommonsPhoto[] } | { error: string }> {
  try {
    await guard();
    const photos = await searchCommons(query, 12);
    return { photos };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search failed." };
  }
}

/** Copy a Commons photo into our own bucket and return the URL + the credit line to store with it. */
export async function adoptPhoto(input: { slug: string; thumb: string; credit: string }): Promise<{ photoUrl: string; photoCredit: string } | { error: string }> {
  try {
    await guard();
    const slug = (input.slug || "place").replace(/[^a-z0-9-]/g, "") || "place";
    const { bytes, contentType } = await fetchCommonsBytes(input.thumb);
    const photoUrl = await uploadPhotoBytes(slug, bytes, contentType);
    return { photoUrl, photoCredit: input.credit.trim().slice(0, 160) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't use that photo." };
  }
}

/* ───────────────────────── recommendations inbox ───────────────────────── */

export async function markSuggestion(id: string, status: SuggestionStatus): Promise<SaveResult> {
  try {
    await guard();
    await setSuggestionStatus(id, status);
    return { ok: true, slug: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't update that." };
  }
}

export async function adminStatus() {
  await guard();
  const { configured, writable } = dbConfig();
  return { configured, writable };
}
