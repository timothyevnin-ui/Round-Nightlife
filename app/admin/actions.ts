"use server";

import Anthropic from "@anthropic-ai/sdk";
import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminPin, isAdmin, pinMatches, signPin } from "@/lib/adminAuth";
import { ATTR_KEYS, ATTR_LIST, SUGGESTED_TAGS } from "@/lib/attrs";
import { questionsFor, type RecOption, type RecQuestion } from "@/lib/recommendQuestions";
import { dbConfig, deleteVenue as dbDelete, getVenuesFresh, upsertVenues, uploadPhoto, uploadPhotoBytes, VENUES_TAG } from "@/lib/db";
import { fetchCommonsBytes, searchCommons, type CommonsPhoto } from "@/lib/commons";
import { isNeighborhoodId, NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import { neighborhoodAt } from "@/lib/shapes";
import { clamp01, emptyAttrs } from "@/lib/normalize";
import { SEED_VENUES } from "@/lib/venues";
import type { Attrs, Capacity, Hours, NeighborhoodId, Venue, Window } from "@/lib/types";
import { cleanHours } from "@/lib/hours";
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
  /** V11 */
  /** Let Claude turn custom tags into attribute nudges on save (the add flow does this). */
  readTags?: boolean;
  hours?: Hours | null;
  barFood?: boolean;
  cuisine?: string;
  score?: number | null;
  dayDeal?: string;
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
    if (p.readTags) {
      // Custom tags → attributes, only where nothing explicit was answered.
      const nudges = await tagsToAttrs(p.tags ?? []);
      for (const [k, v] of Object.entries(nudges) as [keyof Attrs, number][]) if (typeof p.attrs?.[k] !== "number") attrs[k] = Math.max(attrs[k], v);
    }

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
      hours: p.hours === undefined ? existing?.hours : cleanHours(p.hours),
      barFood: p.barFood === undefined ? existing?.barFood : !!p.barFood,
      cuisine: p.cuisine === undefined ? existing?.cuisine : p.cuisine.trim().slice(0, 40) || undefined,
      score: p.score === undefined ? existing?.score : typeof p.score === "number" && Number.isFinite(p.score) ? Math.max(0, Math.min(100, Math.round(p.score))) : undefined,
      dayDeal: p.dayDeal === undefined ? existing?.dayDeal : p.dayDeal.trim().slice(0, 120) || undefined,
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
export async function lookupAddress(address: string): Promise<{ lat: number; lng: number; label: string; neighborhood: NeighborhoodId | null } | { error: string }> {
  try {
    await guard();
    const q = address.trim();
    if (!q) return { error: "Type an address first." };
    const base = process.env.ROUND_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";
    const res = await fetch(`${base}?format=json&limit=1&q=${encodeURIComponent(q + (/new york|brooklyn|ny\b/i.test(q) ? "" : ", New York, NY"))}`, {
      headers: { "User-Agent": "ROUND back office (nightlife app; contact via site)" },
      cache: "no-store",
    });
    if (!res.ok) return { error: `Lookup failed (${res.status}).` };
    const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!json[0]) return { error: "Couldn't find that address." };
    const lat = Number(json[0].lat);
    const lng = Number(json[0].lon);
    return { lat, lng, label: json[0].display_name, neighborhood: neighborhoodAt(lat, lng) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Lookup failed." };
  }
}

/* ───────────────────────── questions that think ───────────────────────── */

export type NextQuestion = { question?: RecQuestion; done?: boolean; source: "claude" | "bank"; error?: string };

const OPTION_KEYS = ["price", "easyIn", "groupBig", "dateFit", "capacity"] as const;

/**
 * The next question to ask about a place, given everything answered so far.
 * With a key, Claude writes it: it skips what's already implied (a yes to
 * live music makes "loud?" pointless; ask whether people sit and listen or
 * stand and sing), asks restaurant things of restaurants, and never asks
 * more than ten. Without a key, the fixed bank asks in order. Either way the
 * answer lands in the same attribute fields the algorithm reads.
 */
export async function nextQuestion(input: { name: string; kind: "bar" | "restaurant"; barFood?: boolean; cuisine?: string; tags: string[]; said: string[]; asked: number; attrs: Partial<Attrs> }): Promise<NextQuestion> {
  try {
    await guard();
    const bank = questionsFor(input.kind);
    const key = process.env.ANTHROPIC_API_KEY;
    if (input.asked >= 10) return { done: true, source: key ? "claude" : "bank" };
    if (!key) {
      const q = bank[input.asked];
      return q ? { question: q, source: "bank" } : { done: true, source: "bank" };
    }
    const client = new Anthropic({ apiKey: key, timeout: 12000, maxRetries: 0 });
    const attrList = ATTR_LIST.map((a) => `${a.key} (${a.label})`).join(", ");
    const known = (Object.entries(input.attrs) as [string, number][]).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k}=${v}`).join(", ");
    const res = await client.messages.create({
      model: process.env.ROUND_TEXT_MODEL ?? "claude-sonnet-5",
      max_tokens: 400,
      system:
        "You help the founder of ROUND, a NYC nightlife app, describe a place by asking one short question at a time, the way the app asks people about their night. " +
        "Each answer is a button, and each button maps to the app's attributes (0 = not at all, 1 = very). Your job is to ask the single most useful question that is NOT already answered or implied. " +
        "Rules: never ask what's implied (yes to dancing implies loud, so ask DJ or band instead; yes to live music: ask whether people sit and listen or stand and sing along; a restaurant gets restaurant questions: reservations, noise, shared plates, price per head, late kitchen, date-or-group, wine-or-cocktails, bougie-or-chill). Never ask about dress codes or what to wear: ROUND doesn't do dress codes; the question is whether the room is bougie or chill. " +
        "Keep the founder's voice: plain, quick, a little dry. Prompt ≤ 9 words. Two or three options, labels ≤ 4 words. Stop (done: true) when the important things are covered, usually after 7–10 questions. " +
        `Attributes you may set: ${attrList}. You may also set price (1–4), easyIn (0–1, how easy to walk in at peak), groupBig (0–1, fit for 8+), dateFit (0–1), capacity (tiny|small|medium|large). ` +
        'Respond with JSON only: {"done": false, "id": "short-id", "prompt": "…", "short": "≤ 12 chars", "options": [{"label": "…", "attrs": {key: 0..1}, "price"?: n, "easyIn"?: n, "groupBig"?: n, "dateFit"?: n, "capacity"?: "…"}]} or {"done": true}.',
      messages: [
        {
          role: "user",
          content:
            `Place: ${input.name} — ${input.kind}${input.barFood ? " with a kitchen" : ""}${input.cuisine ? `, ${input.cuisine}` : ""}.\n` +
            `Tags the founder gave: ${input.tags.join(", ") || "none"}.\n` +
            `Asked so far (${input.asked}): ${input.said.join(" · ") || "nothing yet"}.\n` +
            `Attributes already set: ${known || "none"}.\n` +
            `Ask the next question, or say done.`,
        },
      ],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as { done?: boolean; id?: string; prompt?: string; short?: string; options?: unknown };
    if (json.done) return { done: true, source: "claude" };
    const options: RecOption[] = (Array.isArray(json.options) ? json.options : [])
      .map((o) => {
        if (!o || typeof o !== "object") return null;
        const x = o as Record<string, unknown>;
        const label = typeof x.label === "string" ? x.label.trim().slice(0, 28) : "";
        if (!label) return null;
        const attrs: Partial<Attrs> = {};
        if (x.attrs && typeof x.attrs === "object") for (const [k, v] of Object.entries(x.attrs as Record<string, unknown>)) if ((ATTR_KEYS as readonly string[]).includes(k) && typeof v === "number") attrs[k as keyof Attrs] = clamp01(v, 0);
        const opt: RecOption = { label, attrs };
        for (const k of OPTION_KEYS) {
          const v = x[k];
          if (k === "capacity") {
            if (typeof v === "string" && ["tiny", "small", "medium", "large"].includes(v)) opt.capacity = v as RecOption["capacity"];
          } else if (k === "price") {
            if (typeof v === "number" && v >= 1 && v <= 4) opt.price = Math.round(v) as 1 | 2 | 3 | 4;
          } else if (typeof v === "number") opt[k] = clamp01(v, 0.5);
        }
        return opt;
      })
      .filter((o): o is RecOption => !!o)
      .slice(0, 3);
    const prompt = typeof json.prompt === "string" ? json.prompt.trim().slice(0, 80) : "";
    if (!prompt || options.length < 2) {
      const q = bank[input.asked];
      return q ? { question: q, source: "bank" } : { done: true, source: "bank" };
    }
    const id = (typeof json.id === "string" && json.id.trim() ? json.id.trim() : prompt).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || `q${input.asked}`;
    return { question: { id, prompt, short: typeof json.short === "string" ? json.short.slice(0, 12) : prompt.slice(0, 12), options }, source: "claude" };
  } catch (e) {
    const bank = questionsFor(input.kind);
    const q = bank[input.asked];
    return q ? { question: q, source: "bank", error: e instanceof Error ? e.message : "model failed" } : { done: true, source: "bank" };
  }
}

/**
 * Tags the founder typed that aren't in the app's list ("dim lighting",
 * "niche") mean something. Claude turns them into attribute nudges so the
 * rules engine understands them too; Claude's own picking reads the tags as
 * words anyway. Answered attributes always win over a nudge.
 */
const tagMemo = new Map<string, Partial<Attrs>>();
export async function tagsToAttrs(tags: string[]): Promise<Partial<Attrs>> {
  const key = process.env.ANTHROPIC_API_KEY;
  const unknown = tags.map((t) => t.trim()).filter((t) => t && !SUGGESTED_TAGS.some((s) => s.toLowerCase() === t.toLowerCase()));
  if (!key || !unknown.length) return {};
  const memoKey = unknown.map((t) => t.toLowerCase()).sort().join("|");
  const hit = tagMemo.get(memoKey);
  if (hit) return hit;
  try {
    const client = new Anthropic({ apiKey: key, timeout: 10000, maxRetries: 0 });
    const res = await client.messages.create({
      model: process.env.ROUND_TEXT_MODEL ?? "claude-sonnet-5",
      max_tokens: 300,
      system: `Map descriptive tags for a bar or restaurant onto these attributes (0–1, only when the tag clearly implies it; leave out anything it doesn't): ${ATTR_LIST.map((a) => `${a.key} (${a.label})`).join(", ")}. Respond with JSON only: {attributeKey: number}. Example: "dim lighting" → {"date": 0.7, "chill": 0.5, "lively": 0.2}.`,
      messages: [{ role: "user", content: `Tags: ${unknown.join(", ")}` }],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const attrs: Partial<Attrs> = {};
    for (const [k, v] of Object.entries(json)) if ((ATTR_KEYS as readonly string[]).includes(k) && typeof v === "number") attrs[k as keyof Attrs] = clamp01(v, 0);
    tagMemo.set(memoKey, attrs);
    return attrs;
  } catch (e) {
    console.warn("[admin] tagsToAttrs failed", e);
    return {};
  }
}

/**
 * "Fill in from the web": read the place's own site and pull out the posted
 * hours, what kind of food, and whether the bar has a kitchen. Claude does the
 * reading; nothing is guessed (unknown stays null). Needs ANTHROPIC_API_KEY.
 */
export type WebFill = { hours?: Hours | null; cuisine?: string | null; barFood?: boolean | null; summary?: string; source: string };

export async function fillFromWeb(input: { url: string; name: string; address?: string }): Promise<{ fill?: WebFill; error?: string }> {
  try {
    await guard();
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { error: "Add ANTHROPIC_API_KEY to the deployment to read the web." };
    let url = input.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    let text = "";
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ROUND/1.0; +https://round.nyc)" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
      if (!res.ok) return { error: `That site answered ${res.status}.` };
      const html = (await res.text()).slice(0, 400000);
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<\/(p|div|li|tr|h[1-6]|br|section|article)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim()
        .slice(0, 24000);
    } catch (e) {
      return { error: `Couldn't reach that site (${e instanceof Error ? e.message : "network"}).` };
    }
    if (text.length < 80) return { error: "That page has no readable text (many bar sites are one big image). Type the hours in instead." };
    const client = new Anthropic({ apiKey: key, timeout: 20000, maxRetries: 0 });
    const res = await client.messages.create({
      model: process.env.ROUND_TEXT_MODEL ?? "claude-sonnet-5",
      max_tokens: 500,
      system:
        "You read a bar or restaurant's website and extract facts for a nightlife app. Use only what the page says. Never guess. " +
        'Respond with JSON only: {"hours": [7 entries, Sunday first, each {"open":"HH:MM","close":"HH:MM"} in 24h or null when closed] or null when the page does not state hours, "cuisine": short string like "Italian" or "Cheesesteaks" or null, "barFood": true if a bar with a real food menu / kitchen, false if clearly drinks-only, null if unclear, "summary": one plain sentence of what the page says the place is (max 25 words)}. ' +
        "Closing times after midnight are written as small hours (2am = \"02:00\"). If hours are given as a single range for every day, repeat it seven times. If only weekday/weekend splits are given, map them to the right days.",
      messages: [{ role: "user", content: `Place: ${input.name}${input.address ? ` at ${input.address}` : ""}.\nPage (${url}):\n"""${text}"""` }],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as { hours?: unknown; cuisine?: unknown; barFood?: unknown; summary?: unknown };
    const hours = cleanHours(json.hours) ?? null;
    return {
      fill: {
        hours,
        cuisine: typeof json.cuisine === "string" && json.cuisine.trim() ? json.cuisine.trim().slice(0, 40) : null,
        barFood: typeof json.barFood === "boolean" ? json.barFood : null,
        summary: typeof json.summary === "string" ? json.summary.slice(0, 200) : undefined,
        source: url,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that page." };
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

/* ───────────────────────── notes → a whole place (Claude) ───────────────────────── */

export type DraftedPlace = {
  name?: string;
  kind?: "bar" | "restaurant";
  neighborhood?: string;
  address?: string;
  take?: string;
  theCatch?: string;
  tags?: string[];
  attrs?: Partial<Attrs>;
  groupFit?: Venue["groupFit"];
  dateFit?: Venue["dateFit"];
  price?: number;
  capacity?: Capacity;
  easyIn?: number;
  bestWindows?: "everyNight" | "weekendLate" | "earlyEvening" | "dinner" | "cocktailHours" | "brooklynLate";
};

const WINDOW_PRESETS: Record<NonNullable<DraftedPlace["bestWindows"]>, Window[]> = {
  everyNight: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 26 }],
  weekendLate: [
    { days: [4, 5, 6], from: 21, to: 27 },
    { days: [0, 1, 2, 3], from: 19, to: 25 },
  ],
  earlyEvening: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 17, to: 23 }],
  dinner: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 23 }],
  cocktailHours: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 19, to: 25 }],
  brooklynLate: [
    { days: [4, 5, 6], from: 21, to: 28 },
    { days: [0, 1, 2, 3], from: 19, to: 26 },
  ],
};

/**
 * Paste raw thoughts about a place ("went to X on Bleecker Thurs, packed by
 * 10, $9 beers, back room, DJ after 11…") and get the whole form filled in.
 * Only from what's in the notes; the founder still reads it before saving.
 */
export async function draftFromNotes(notes: string): Promise<{ draft?: DraftedPlace & { bestWindowsResolved?: Window[] }; error?: string }> {
  try {
    await guard();
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { error: "Add ANTHROPIC_API_KEY to the deployment to draft with AI." };
    const text = notes.trim().slice(0, 4000);
    if (text.length < 10) return { error: "Give it a few more words." };
    const hoods = NEIGHBORHOODS.map((n) => `${n.id} (${n.name})`).join(", ");
    const attrs = ATTR_LIST.map((a) => `${a.key}: ${a.label} — ${a.hint}`).join("\n");
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: process.env.ROUND_TEXT_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system:
        "You turn a founder's raw notes about one NYC bar or restaurant into a structured entry for ROUND, a nightlife recommendation app. " +
        "Voice for take and theCatch: editorial, confident, dry, specific, warm; one sentence each; no exclamation points; never marketing. " +
        "Use ONLY facts in the notes. Never invent an address, hours, prices or history: leave a field out if the notes don't support it. " +
        "Attributes are 0, 0.5 or 1 (no / some / yes) and only for traits the notes speak to. Respond with JSON only.",
      messages: [
        {
          role: "user",
          content:
            `Notes: """${text}"""\n\n` +
            `Return JSON with any of: {"name": string, "kind": "bar"|"restaurant", "neighborhood": one of [${hoods}] or omit, "address": string, ` +
            `"take": string (max 28 words), "theCatch": string (max 22 words, practical: lines, when to go, what to order), "tags": [2-4 short labels], ` +
            `"attrs": {key: 0|0.5|1}, "groupFit": {"two","small","mid","big": 0-1}, "dateFit": {"first","early","longterm": 0-1}, ` +
            `"price": 1-4 (1 under $10 drinks, 2 $10-16, 3 $17-24, 4 splurge), "capacity": "tiny"|"small"|"medium"|"large", ` +
            `"easyIn": 0.85 walk in | 0.65 usually fine | 0.4 often a wait | 0.15 good luck, "bestWindows": "everyNight"|"weekendLate"|"earlyEvening"|"dinner"|"cocktailHours"|"brooklynLate"}\n` +
            `Attribute keys:\n${attrs}`,
        },
      ],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as DraftedPlace;
    const draft: DraftedPlace & { bestWindowsResolved?: Window[] } = {};
    if (typeof json.name === "string") draft.name = json.name.trim().slice(0, 80);
    if (json.kind === "bar" || json.kind === "restaurant") draft.kind = json.kind;
    if (isNeighborhoodId(json.neighborhood)) draft.neighborhood = json.neighborhood;
    if (typeof json.address === "string") draft.address = json.address.trim().slice(0, 160);
    if (typeof json.take === "string") draft.take = json.take.trim().slice(0, 220);
    if (typeof json.theCatch === "string") draft.theCatch = json.theCatch.trim().slice(0, 160);
    if (Array.isArray(json.tags)) draft.tags = json.tags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 4);
    if (json.attrs && typeof json.attrs === "object") {
      const a: Partial<Attrs> = {};
      for (const k of ATTR_KEYS) {
        const v = (json.attrs as Record<string, unknown>)[k];
        if (typeof v === "number") a[k] = clamp01(v, 0);
      }
      draft.attrs = a;
    }
    const fit = (o: unknown, keys: string[]) => (o && typeof o === "object" && keys.every((k) => typeof (o as Record<string, unknown>)[k] === "number") ? (o as Record<string, number>) : undefined);
    const g = fit(json.groupFit, ["two", "small", "mid", "big"]);
    if (g) draft.groupFit = { two: clamp01(g.two), small: clamp01(g.small), mid: clamp01(g.mid), big: clamp01(g.big) };
    const d = fit(json.dateFit, ["first", "early", "longterm"]);
    if (d) draft.dateFit = { first: clamp01(d.first), early: clamp01(d.early), longterm: clamp01(d.longterm) };
    if ([1, 2, 3, 4].includes(Number(json.price))) draft.price = Number(json.price);
    if (json.capacity && ["tiny", "small", "medium", "large"].includes(json.capacity)) draft.capacity = json.capacity;
    if (typeof json.easyIn === "number") draft.easyIn = clamp01(json.easyIn, 0.5);
    if (json.bestWindows && json.bestWindows in WINDOW_PRESETS) {
      draft.bestWindows = json.bestWindows;
      draft.bestWindowsResolved = WINDOW_PRESETS[json.bestWindows];
    }
    return { draft };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draft failed." };
  }
}

/* ───────────────────────── Studio: flags and stories ───────────────────────── */

/** Flip verified / on-the-shelf for one or many places, touching nothing else. */
export async function setFlags(slugs: string[], patch: { verified?: boolean; hot?: boolean }): Promise<SaveResult> {
  try {
    await guard();
    const { venues } = await getVenuesFresh();
    const set = new Set(slugs);
    const changed = venues.filter((v) => set.has(v.slug)).map((v) => ({ ...v, ...(patch.verified !== undefined ? { verified: patch.verified } : {}), ...(patch.hot !== undefined ? { hot: patch.hot } : {}) }));
    if (changed.length) await upsertVenues(changed);
    updateTag(VENUES_TAG);
    return { ok: true, slug: String(changed.length) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't update." };
  }
}

/** Save a story (the blog) and its shelf settings for one place. */
export async function saveStory(slug: string, input: { story: string; hot: boolean; hotRank: number | null }): Promise<SaveResult> {
  try {
    await guard();
    const { venues } = await getVenuesFresh();
    const v = venues.find((x) => x.slug === slug);
    if (!v) return { ok: false, error: "That place isn't in the database." };
    const story = input.story.trim().slice(0, 12000);
    await upsertVenues([{ ...v, story: story || undefined, hot: !!input.hot, hotRank: Number.isFinite(Number(input.hotRank)) && input.hotRank !== null ? Number(input.hotRank) : undefined }]);
    updateTag(VENUES_TAG);
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the story." };
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

/** Is this browser signed into Studio? Never throws; the venue page asks before showing its Studio bar. */
export async function isStudio(): Promise<boolean> {
  try {
    return await isAdmin();
  } catch {
    return false;
  }
}
