import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { interpretPrompt, interpretText, type Interpretation } from "@/lib/interpret";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import { ATTR_KEYS } from "@/lib/attrs";
import { getVenues } from "@/lib/db";
import { allowModelCall, ipFrom } from "@/lib/ratelimit";
import { geocode, looksLikeAddress } from "@/lib/geocode";
import { matchVenues, nameScore, normalizeName } from "@/lib/match";

export const runtime = "nodejs";
export const maxDuration = 30;

// Understanding the sentence is where a wrong neighborhood or a missed street
// costs the most, so this defaults to the stronger model; the fast one is the
// backstop if that name isn't available on the key.
const MODEL = process.env.ROUND_TEXT_MODEL ?? "claude-sonnet-5";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

/** A point that's plausibly in New York City. */
function nycPoint(x: unknown): { label: string; lat: number; lng: number } | undefined {
  if (!x || typeof x !== "object") return undefined;
  const p = x as { label?: unknown; lat?: unknown; lng?: unknown };
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const label = typeof p.label === "string" ? p.label.trim().slice(0, 60) : "";
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < 40.49 || lat > 40.92 || lng < -74.27 || lng > -73.68) return undefined;
  return { label, lat, lng };
}

/**
 * "Near X" where X isn't one of ours: an address, a restaurant, a park, a
 * corner. The geocoder settles the point. It wins outright for a street
 * address; for a named place it wins when it clearly found that name, and
 * otherwise Claude's own coordinates (good for landmarks) stand.
 */
async function settlePlace(text: string, guess: { label: string; lat: number; lng: number } | undefined, venues: { name: string }[]): Promise<{ label: string; lat: number; lng: number } | undefined> {
  const said = spotInText(text);
  const label = guess?.label ?? said;
  if (!label) return guess;
  // Never geocode one of our own places (the venue path handles those).
  if (matchVenues(label, venues, 1).length) return guess;
  const hit = await geocode(label);
  if (!hit) return guess;
  if (!guess || looksLikeAddress(label) || nameScore(normalizeName(label), hit.label) >= 0.55) return { label: hit.label, lat: hit.lat, lng: hit.lng };
  return guess;
}

/** "near 34 E 4th St", "by Rubirosa", "I'm at the Bedford L", "around Grand Central" → the thing after the lead-in. */
function spotInText(text: string): string | undefined {
  const m = /\b(?:near|by|around|at|outside|next to|close to|from)\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9 .'&-]{2,50}?)(?=\s*(?:,|\.|;|\band\b|\bfor\b|\bwith\b|\baround\b|\bat\s+\d|\btonight\b|\btn\b|\btomorrow\b|\bthis\b|\bwe\b|\bi\b|$))/i.exec(text);
  if (!m) return undefined;
  const spot = m[1].trim().replace(/\s+(st|street|ave|avenue)\.?$/i, (x) => x);
  // Neighborhood names are handled by the neighborhood pass, not the geocoder.
  if (/^(the )?(west village|east village|village|les|lower east side|soho|nolita|tribeca|chelsea|williamsburg|greenpoint|murray hill|kips bay|city|bar|bars|restaurant)$/i.test(spot)) return undefined;
  return spot.length >= 3 ? spot : undefined;
}

/** POST { text } → an Interpretation. Claude when a key is set, keywords otherwise. */
export async function POST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").toString().slice(0, 400);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const venues = await getVenues();
  const forMatch = venues.map((v) => ({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng }));
  const keyword = interpretText(text, forMatch);
  const key = process.env.ANTHROPIC_API_KEY;
  const log = (i: Interpretation, engine: string) =>
    after(() => logEvent({ kind: "sayit", q: text, slug: i.venue?.slug ?? null, data: { engine, mode: i.mode, neighborhood: i.neighborhood ?? null, near: !!i.near, place: i.place?.label ?? null, wants: Object.keys(i.wants), understood: i.understood } }));
  const keywordsOnly = async (engine: string) => {
    if (!keyword.venue) {
      const place = await settlePlace(text, undefined, forMatch);
      if (place) {
        keyword.place = place;
        keyword.near = true;
        keyword.understood = [`near ${place.label}`, ...keyword.understood].slice(0, 7);
      }
    }
    log(keyword, engine);
    return NextResponse.json({ interpretation: keyword, engine: "keywords" });
  };
  if (!key) return keywordsOnly("keywords");
  if (!allowModelCall(ipFrom(req.headers))) return keywordsOnly("keywords-ratelimited");

  try {
    const client = new Anthropic({ apiKey: key, timeout: 12000, maxRetries: 0 });
    const ask = async (model: string) => {
      const res = await client.messages.create({
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: interpretPrompt(text, forMatch) }],
      });
      const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      return { model, json: JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Partial<Omit<Interpretation, "venue" | "place">> & { venue?: string | null; near?: boolean; place?: unknown } };
    };
    let got: Awaited<ReturnType<typeof ask>>;
    try {
      got = await ask(MODEL);
    } catch (e) {
      if (MODEL === FALLBACK_MODEL) throw e;
      console.warn(`[interpret] ${MODEL} failed (${e instanceof Error ? e.message : e}); trying ${FALLBACK_MODEL}`);
      got = await ask(FALLBACK_MODEL);
    }
    const json = got.json;
    const named = typeof json.venue === "string" ? forMatch.find((v) => v.slug === json.venue) : undefined;
    const venue = named ? { slug: named.slug, name: named.name, neighborhood: named.neighborhood, lat: named.lat, lng: named.lng } : keyword.venue;
    const near = named ? !!json.near : keyword.near;
    const wants: Interpretation["wants"] = {};
    for (const [k, v] of Object.entries(json.wants ?? {})) {
      if ((ATTR_KEYS as readonly string[]).includes(k) || k === "noLine" || k === "new") {
        const n = Number(v);
        if (Number.isFinite(n) && n !== 0) wants[k as keyof Interpretation["wants"]] = Math.max(-1, Math.min(1, n));
      }
    }
    const merged: Interpretation = {
      mode: json.mode === "date" || json.mode === "dinner" ? json.mode : keyword.mode,
      neighborhood: isNeighborhoodId(json.neighborhood) ? json.neighborhood : keyword.neighborhood,
      group: typeof json.group === "number" && json.group >= 2 ? Math.min(11, Math.round(json.group)) : keyword.group,
      hour: typeof json.hour === "number" && json.hour >= 12 && json.hour <= 28 ? json.hour : keyword.hour,
      stage: json.stage && ["first", "early", "longterm"].includes(json.stage) ? json.stage : keyword.stage,
      dinner: typeof json.dinner === "boolean" ? json.dinner : keyword.dinner,
      wants: Object.keys(wants).length ? wants : keyword.wants,
      understood: Array.isArray(json.understood) && json.understood.length ? json.understood.map(String).slice(0, 7) : keyword.understood,
      venue,
      near,
      place: venue ? undefined : await settlePlace(text, nycPoint(json.place), forMatch),
    };
    if (venue && !isNeighborhoodId(json.neighborhood)) merged.neighborhood = venue.neighborhood;
    if (venue && !merged.understood.some((u) => u.toLowerCase().includes(venue.name.toLowerCase()))) merged.understood = [near ? `near ${venue.name}` : venue.name, ...merged.understood].slice(0, 7);
    if (merged.place && !merged.understood.some((u) => u.toLowerCase().includes(merged.place!.label.toLowerCase()))) merged.understood = [`near ${merged.place.label}`, ...merged.understood].slice(0, 7);
    log(merged, `claude:${got.model}`);
    return NextResponse.json({ interpretation: merged, engine: "claude" });
  } catch (e) {
    console.error("[interpret] model failed, using keywords", e);
    return keywordsOnly("keywords-fallback");
  }
}
