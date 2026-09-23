import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ATTRS, type AttrKey } from "./attrs";
import { haversineMeters, isDaytime } from "./engine";
import { NEIGHBORHOODS, neighborhoodName } from "./neighborhoods";
import { allowModelCall } from "./ratelimit";
import { CARDS, type Wants } from "./questions";
import { formatHour } from "./time";
import { weekSummary } from "./hours";
import type { DatePlan, DateStage, NeighborhoodId, NightPick, PickLabel, Venue } from "./types";

/**
 * Claude picks the six. The rules engine (engine.ts) still runs first: it
 * narrows the field and ranks it, and it is the answer when there's no key,
 * the model is slow, or anything goes wrong. When Claude is on, it reads the
 * whole ROUND catalog (cached, so each call is cheap), the request in plain
 * words, and the engine's order as a hint, then returns the six that really
 * fit, in order, with one honest line on each.
 */

export const PICK_MODEL = process.env.ROUND_PICK_MODEL ?? "claude-sonnet-5";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = Number(process.env.ROUND_PICK_TIMEOUT_MS ?? 9000);
const CACHE_TTL_MS = Number(process.env.ROUND_PICK_MEMO_MS ?? 15 * 60_000);

export type PickMode = "night" | "date" | "dinner" | "near" | "around";

export type PickRequest = {
  mode: PickMode;
  /** Who's asking (for the rate limit); null skips the per-caller limit. */
  ip?: string | null;
  /** The sentence they typed, when there is one. */
  said?: string;
  neighborhood?: NeighborhoodId;
  /** Somewhere they're standing or named: a street, a landmark, a venue. */
  place?: { label: string; lat: number; lng: number; /** When the spot is one of ours. */ slug?: string };
  /** A ROUND place they named ("like Bar Primi but louder"). */
  anchor?: Venue;
  group?: number;
  hour: number;
  dow: number;
  stage?: DateStage;
  dinner?: boolean;
  wants: Wants;
  been?: string[];
  /** The person's own taste, when they've rated things (from the taste cookie). */
  taste?: { loves: string[]; nevers: string[]; tags: string[]; usual?: [string, string][] };
  /** Their first name, when signed in. */
  name?: string;
  /** Their favorite bar in the city, when it's one of ours (slug). */
  favorite?: string;
};

export type Picked = { slug: string; why: string; label?: PickLabel; then?: string };
export type PickResult = { picks: Picked[]; heard?: string; engine: "claude" | "rules"; model?: string; ms: number; note?: string };

const LABELS: PickLabel[] = ["Also great", "Easy in", "Late one", "Cheap and good", "Splurge", "Big room", "Classic", "Sleeper", "Wildcard"];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ───────────────────────── the catalog (cached prompt) ───────────────────────── */

let catalogCache: { key: string; text: string } | null = null;

function windowWord(v: Venue): string {
  const w = v.bestWindows[0];
  if (!w) return "";
  const late = Math.max(...v.bestWindows.map((x) => x.to));
  const weekendOnly = v.bestWindows.some((x) => x.days.length <= 3);
  return `${weekendOnly ? "best Thu–Sat" : "any night"} ${formatHour(w.from)}–${formatHour(late)}${late >= 26 ? " (late)" : ""}`;
}

function venueLine(v: Venue): string {
  const strong = (Object.entries(v.attrs) as [AttrKey, number][])
    .filter(([, n]) => n >= 0.7)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([k]) => ATTRS[k]?.label ?? k);
  const weak = (Object.entries(v.attrs) as [AttrKey, number][])
    .filter(([k, n]) => n <= 0.15 && ["talk", "date", "dance", "liveMusic", "sports", "cheap"].includes(k))
    .map(([k]) => ATTRS[k]?.label ?? k);
  const street = v.address.replace(/,\s*(New York|Brooklyn).*$/i, "");
  const fit = v.groupFit;
  const groups = fit.big >= 0.75 ? "big groups fine" : fit.mid >= 0.75 ? "up to 7" : fit.small >= 0.7 ? "2–4" : "twos";
  const dateWord = v.dateFit.first >= 0.7 ? "first-date safe" : v.dateFit.longterm >= 0.7 ? "good for couples" : v.dateFit.first <= 0.25 ? "not a date place" : "";
  return [
    `• ${v.slug} — ${v.name} (${v.kind}${v.barFood ? " with a kitchen" : ""}, ${neighborhoodName(v.neighborhood)}, ${street})${v.verified ? " ✓ VERIFIED" : ""}${typeof v.score === "number" ? ` · ROUND score ${v.score}/100` : ""}`,
    `  ${"$".repeat(v.price)} · ${v.capacity} room · ${groups} · walk-in ${v.easyIn >= 0.7 ? "easy" : v.easyIn >= 0.45 ? "possible" : "hard"} · ${windowWord(v)}${dateWord ? ` · ${dateWord}` : ""}`,
    `  is: ${strong.join(", ") || "—"}${weak.length ? ` · isn't: ${weak.join(", ")}` : ""}${v.tags.length ? ` · tags: ${v.tags.join(", ")}` : ""}${v.cuisine || v.barFood ? ` · food: ${v.cuisine ?? "yes"}${v.barFood ? " (bar with a kitchen)" : ""}` : ""}${v.hours ? ` · hours: ${weekSummary(v.hours)}` : ""} · in daylight: ${v.attrs.daytime >= 0.7 ? "good" : v.attrs.daytime >= 0.4 ? "fine" : "no"}${v.dayDeal ? ` · day deal: ${v.dayDeal}` : ""}`,
    `  ${v.take}${v.theCatch ? ` Catch: ${v.theCatch}` : ""}`,
  ].join("\n");
}

/** Deterministic, so the same venues give the same bytes and the cache hits. */
export function buildCatalog(venues: Venue[]): string {
  // A cheap fingerprint of everything that goes into the text.
  let h = 5381;
  for (const v of [...venues].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const str = `${v.slug}|${v.name}|${v.neighborhood}|${v.address}|${v.take}|${v.theCatch ?? ""}|${v.tags.join(",")}|${v.price}|${v.capacity}|${v.easyIn}|${v.verified ? 1 : 0}|${v.score ?? ""}|${v.cuisine ?? ""}|${v.dayDeal ?? ""}|${v.barFood ? 1 : 0}|${JSON.stringify(v.hours ?? null)}|${JSON.stringify(v.attrs)}|${JSON.stringify(v.groupFit)}|${JSON.stringify(v.dateFit)}`;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  const key = `${venues.length}:${h}`;
  if (catalogCache && catalogCache.key === key) return catalogCache.text;
  const hoods = NEIGHBORHOODS.map((n) => `${n.name} (adjacent: ${n.adjacent.map((a) => neighborhoodName(a)).join(", ")})`).join("; ");
  const sorted = [...venues].sort((a, b) => a.slug.localeCompare(b.slug));
  const text =
    `You are ROUND, a nightlife guide for New York. Below is every place ROUND covers: the slug, what it is, where, price ($ cheap … $$$$ splurge), room size, group fit, how hard the door is, when it's good, what it's known for (is / isn't), and ROUND's own take and catch.\n` +
    `Neighborhoods: ${hoods}.\n\n` +
    sorted.map(venueLine).join("\n") +
    `\n\n✓ VERIFIED means someone from ROUND has been and stands behind the entry; everything else is researched but unvisited. "ROUND score" is how much we like a place, 0–100; between two places that fit equally, prefer the higher score. Only ever recommend places from this list, by slug. Never invent a place.`;
  catalogCache = { key, text };
  return text;
}

/* ───────────────────────── the request, in words ───────────────────────── */

function wantsWords(wants: Wants): { want: string[]; avoid: string[] } {
  const want: string[] = [];
  const avoid: string[] = [];
  for (const [k, n] of Object.entries(wants) as [keyof Wants, number][]) {
    if (!n) continue;
    const label = k === "noLine" ? "no line / can walk in" : k === "new" ? "somewhere they haven't been" : ATTRS[k as AttrKey]?.label ?? k;
    (n > 0 ? want : avoid).push(`${label}${Math.abs(n) < 0.5 ? " (slightly)" : ""}`);
  }
  return { want, avoid };
}

function requestWords(r: PickRequest, hints: string[]): string {
  const lines: string[] = [];
  const day = isDaytime(r.hour);
  const chapter =
    r.hour >= 24
      ? " (after midnight: the night is in full swing; late-open rooms, energy, no first-stop places)"
      : day
        ? " (DAYTIME: they want somewhere good in daylight right now — outside, a game on, a deal, sun, a long afternoon; do not send them to a room that only works at 11pm, and weigh the 'good in daylight' score heavily)"
        : r.hour < 20.5
          ? " (EARLY EVENING: the night is getting started, not peaking — think first stop: a seat, a drink you can talk over, a deal, maybe food; a room that is dead until 11 is a miss now, and nobody is dancing at 7:45)"
          : r.hour < 22.5
            ? " (MID EVENING: the night is finding its pulse — lively rooms that are already going by 9, places that build toward later; a sleepy first-stop bar is a miss now)"
            : " (LATE: the night itself — energy, dancing if they want it, rooms that are good at midnight and open late)";
  const when = `${DAY[r.dow] ?? "tonight"} around ${formatHour(r.hour, true)}${chapter}`;
  if (r.mode === "near") {
    const vague = !Object.keys(r.wants).length;
    lines.push(`They are at ${r.place?.label ?? "a spot"} and want somewhere within a short walk, ${when}.${r.place?.slug ? ` (${r.place.slug} is where they're standing; never pick it.)` : ""}`);
    if (vague) lines.push(`They gave no specifics, just the spot, so ROUND's ranking system decides: ✓ VERIFIED places first, then the shortest walk, then ROUND score. The hints below are already in that order (each with its walk time); keep it unless a place is clearly wrong for the hour.`);
  }
  else if (r.mode === "around" && r.anchor) lines.push(`They named ${r.anchor.name} (${r.anchor.slug}). Lead with it, then build the night around it: places that fit the same DNA plus what they asked for. ${when}.`);
  else if (r.mode === "date") lines.push(`A date, ${{ first: "first date", early: "a few dates in", longterm: "long-term couple" }[r.stage ?? "early"]}, ${r.dinner ? "dinner then drinks" : "drinks only"}, ${r.neighborhood ? `in ${neighborhoodName(r.neighborhood)}` : ""}, ${when}.`);
  else if (r.mode === "dinner") lines.push(`Dinner and drinks for a group of ${r.group ?? 4}${r.neighborhood ? ` in ${neighborhoodName(r.neighborhood)}` : ""}, ${when}.`);
  else lines.push(`A night out for ${r.group ?? 4} people${r.neighborhood ? ` in ${neighborhoodName(r.neighborhood)}` : ""}, ${when}.`);
  if (r.place && r.mode !== "near") lines.push(`They mentioned being near ${r.place.label}.`);
  const { want, avoid } = wantsWords(r.wants);
  if (want.length) lines.push(`They want: ${want.join(", ")}.`);
  if (avoid.length) lines.push(`They want to avoid: ${avoid.join(", ")}.`);
  if (r.said) lines.push(`In their own words: "${r.said.replace(/"/g, "'").slice(0, 300)}". The words win over the tags above if they disagree.`);
  if (r.been?.length) lines.push(`They've already been to: ${r.been.slice(0, 20).join(", ")}${(r.wants.new ?? 0) > 0 ? " (they asked for somewhere new)" : ""}.`);
  if (r.taste) {
    const t = r.taste;
    const words = t.tags.map((k) => ATTRS[k as AttrKey]?.label ?? k);
    if (t.loves.length) lines.push(`This person's own ladder, best first (places they'd go back to): ${t.loves.join(", ")}. Read what those places are and lean toward that taste${words.length ? `; the words they use for rooms they loved: ${words.join(", ")}` : ""}.`);
    if (t.nevers.length) lines.push(`Never again, in their words: ${t.nevers.join(", ")}. Do not pick these, and be wary of places just like them.`);
    const usual = (t.usual ?? []).map(([id, label]) => `${CARDS.find((c) => c.id === id)?.prompt ?? id} → ${label}`);
    if (usual.length) lines.push(`How they usually answer ROUND's quick questions (a pattern, learned over their nights out; tonight's answers above win if they differ): ${usual.join("; ")}.`);
  }
  if (r.name) lines.push(`Their first name is ${r.name}. You may use it once in "heard" if it reads naturally ("${r.name}, we heard…"); never in a "why".`);
  if (r.favorite) lines.push(`Their favorite bar in the city is ${r.favorite}: read what that place is in the catalog and lean toward rooms with that DNA when the request leaves room for it. Don't pick it just because it's their favorite unless it fits tonight.`);
  if (hints.length) lines.push(`ROUND's rules engine ranked these first (a hint, not an order): ${hints.join(", ")}.`);
  return lines.join("\n");
}

function instructions(r: PickRequest, count: number): string {
  const pairs = r.mode === "dinner" || (r.mode === "date" && r.dinner);
  return (
    `Pick the ${count} best${pairs ? " restaurants, each with the one bar to go to after (a short walk, ideally under 10 minutes)" : " bars"}, best first. ` +
    `Match what they actually asked for over what merely scores well; a place that nails their one stated need beats a generally great place that doesn't. ` +
    `Stay in the neighborhood they asked for unless something next door is clearly the better answer for their request. Keep the list varied: not six of the same room. ` +
    `If they named a specific place that's in the catalog, it goes first. ` +
    `Verified places (✓) are ROUND's own word: when a verified and an unverified place fit about equally, the verified one goes first, and a verified place that fits well should not lose to an unverified one that fits about as well. Never pick a verified place that doesn't fit what they asked; the check is trust, not a thumb on the scale. ` +
    `For each, "why" is one line, ≤ 14 words, in ROUND's voice: specific and honest about why it fits this request tonight (never generic praise, never a warning dressed as praise). ` +
    `"label" is one of: ${LABELS.map((l) => `"${l}"`).join(", ")} for slots 2–${count} (slot 1 is always "The pick"), each used once and only when true. ` +
    `Also return "heard": ≤ 10 words, what you understood they want, in plain language (no slugs).\n` +
    `Return only compact JSON, nothing else: {"heard": string, "picks": [{"slug": string, "why": string, "label": string${pairs ? ', "then": bar slug' : ""}}]}`
  );
}

/* ───────────────────────── the call ───────────────────────── */

const memo = new Map<string, { at: number; value: PickResult }>();

function memoKey(r: PickRequest, slugs: string[]): string {
  return JSON.stringify([r.mode, r.said ?? "", r.neighborhood ?? "", r.taste ?? null, r.name ?? "", r.favorite ?? "", r.place ? `${r.place.label}@${r.place.lat.toFixed(3)},${r.place.lng.toFixed(3)}` : "", r.anchor?.slug ?? "", r.group ?? 0, Math.round(r.hour * 4), r.dow, r.stage ?? "", r.dinner ?? "", r.wants, (r.been ?? []).slice().sort(), slugs.slice(0, 12)]);
}

/**
 * Ask Claude for the picks. `ranked` is the rules engine's order (slugs) —
 * the fallback and the hint. Never throws: on any trouble it returns the
 * rules order with engine: "rules".
 */
export async function pickWithClaude(r: PickRequest, venues: Venue[], ranked: { slug: string; then?: string }[], count = 6): Promise<PickResult> {
  const t0 = Date.now();
  const rules: PickResult = { picks: ranked.filter((p) => !r.taste?.nevers.includes(p.slug)).slice(0, count).map((p) => ({ slug: p.slug, why: "", then: p.then })), engine: "rules", ms: 0 };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ...rules, note: "no key" };
  if (venues.length === 0) return { ...rules, note: "no venues" };

  const mk = memoKey(r, ranked.map((p) => p.slug));
  const hit = memo.get(mk);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, ms: Date.now() - t0 };
  if (!allowModelCall(r.ip)) return { ...rules, note: "rate limited" };

  const bySlug = new Map(venues.map((v) => [v.slug, v]));
  const hints = ranked.slice(0, 12).map((p) => {
    const v = bySlug.get(p.slug);
    const walk = r.place && v ? ` (${Math.max(1, Math.round(haversineMeters(r.place, v) / 80))} min walk)` : "";
    return `${p.slug}${walk}`;
  });
  const nearby =
    r.place && r.mode === "near"
      ? venues
          .filter((v) => v.kind === "bar")
          .map((v) => ({ v, m: haversineMeters(r.place!, v) }))
          .filter((x) => x.m <= 1600)
          .sort((a, b) => a.m - b.m)
          .slice(0, 40)
          .map((x) => `${x.v.slug} (${Math.max(1, Math.round(x.m / 80))} min)`)
      : [];
  const user =
    requestWords(r, hints) +
    (nearby.length ? `\nWithin a 20-minute walk of ${r.place!.label}, nearest first: ${nearby.join(", ")}. Prefer the closer ones unless a farther one is clearly what they asked for.` : "") +
    `\n\n${instructions(r, count)}`;

  const client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 });
  const system = [{ type: "text" as const, text: buildCatalog(venues), cache_control: { type: "ephemeral" as const } }];

  const ask = async (model: string) => {
    const res = await client.messages.create({ model, max_tokens: 600, system, messages: [{ role: "user", content: user }] });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as { heard?: unknown; picks?: unknown };
    return { json, model };
  };

  let model = PICK_MODEL;
  try {
    let got: Awaited<ReturnType<typeof ask>>;
    try {
      got = await ask(model);
    } catch (e) {
      // A model name that isn't available on this key (or a hiccup): one more try on the fast model.
      if (model === FALLBACK_MODEL || Date.now() - t0 > TIMEOUT_MS) throw e;
      console.warn(`[pick] ${model} failed (${e instanceof Error ? e.message : e}); trying ${FALLBACK_MODEL}`);
      model = FALLBACK_MODEL;
      got = await ask(model);
    }
    const raw = Array.isArray(got.json.picks) ? (got.json.picks as unknown[]) : [];
    const picks: Picked[] = [];
    const used = new Set<string>();
    const pairs = r.mode === "dinner" || (r.mode === "date" && r.dinner);
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const p = item as { slug?: unknown; why?: unknown; label?: unknown; then?: unknown };
      const slug = typeof p.slug === "string" ? p.slug.trim() : "";
      const v = bySlug.get(slug);
      if (!v || used.has(slug)) continue;
      if (r.taste?.nevers.includes(slug)) continue;
      if (pairs ? v.kind !== "restaurant" : v.kind !== "bar") continue;
      if (r.mode === "near" && r.place && haversineMeters(r.place, v) > 2000) continue; // "near" means near
      used.add(slug);
      const label = typeof p.label === "string" && (LABELS as string[]).includes(p.label) ? (p.label as PickLabel) : undefined;
      const then = pairs && typeof p.then === "string" && bySlug.get(p.then)?.kind === "bar" ? p.then : undefined;
      picks.push({ slug, why: clean(typeof p.why === "string" ? p.why : ""), label, then });
      if (picks.length >= count) break;
    }
    // Claude may return fewer than asked; the rules engine fills the rest.
    // (Never-agains are dropped before anything else.)
    for (const p of ranked) {
      if (picks.length >= count) break;
      if (used.has(p.slug) || r.taste?.nevers.includes(p.slug)) continue;
      used.add(p.slug);
      picks.push({ slug: p.slug, why: "", then: p.then });
    }
    if (picks.length === 0) return { ...rules, note: "empty answer", ms: Date.now() - t0 };
    const heard = typeof got.json.heard === "string" ? clean(got.json.heard).slice(0, 80) : undefined;
    const value: PickResult = { picks, heard, engine: "claude", model: got.model, ms: Date.now() - t0 };
    memo.set(mk, { at: Date.now(), value });
    if (memo.size > 500) for (const k of [...memo.keys()].slice(0, 100)) memo.delete(k);
    return value;
  } catch (e) {
    console.error("[pick] model failed, using rules", e);
    return { ...rules, note: e instanceof Error ? e.message.slice(0, 120) : "failed", ms: Date.now() - t0 };
  }
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").trim().slice(0, 140);
}

/* ───────────────────────── applying the answer ───────────────────────── */

/** Reorder the rules engine's bar picks to Claude's answer; keep engine labels/why where Claude gave none. */
export function applyToNight(result: PickResult, rulesPicks: NightPick[], venues: Venue[], lead?: NightPick, count = 6): NightPick[] {
  const fromRules = new Map(rulesPicks.map((p) => [p.venue.slug, p]));
  if (result.engine !== "claude") {
    // The engine's own order, minus anything the person said never again to.
    const kept = result.picks.map((p) => fromRules.get(p.slug)).filter((p): p is NightPick => !!p && p.venue.slug !== lead?.venue.slug);
    return (lead ? [lead, ...kept] : kept).slice(0, count);
  }
  const bySlug = new Map(venues.map((v) => [v.slug, v]));
  const taken = new Set<PickLabel>();
  const out: NightPick[] = [];
  if (lead) {
    out.push(lead);
    taken.add(lead.label);
  }
  for (const p of result.picks) {
    if (lead && p.slug === lead.venue.slug) continue;
    const venue = bySlug.get(p.slug);
    if (!venue) continue;
    const prior = fromRules.get(p.slug);
    let label: PickLabel = out.length === 0 ? "The pick" : p.label && !taken.has(p.label) ? p.label : prior?.label && !taken.has(prior.label) ? prior.label : nextLabel(taken);
    if (out.length > 0 && label === "The pick") label = nextLabel(taken);
    taken.add(label);
    out.push({ venue, label, score: prior?.score ?? 0.5, why: p.why || prior?.why || "" });
  }
  return out.slice(0, count);
}

/** Same for plans (restaurant + bar). Claude's "then" bar wins if it's a real bar within a walk; else the engine's pairing. */
export function applyToPlans(result: PickResult, rulesPlans: DatePlan[], venues: Venue[], bars: Venue[], count = 6): DatePlan[] {
  const fromRules = new Map(rulesPlans.map((p) => [p.restaurant?.slug ?? p.bar.slug, p]));
  if (result.engine !== "claude") return result.picks.map((p) => fromRules.get(p.slug)).filter((p): p is DatePlan => !!p).slice(0, count);
  const bySlug = new Map(venues.map((v) => [v.slug, v]));
  const taken = new Set<PickLabel>();
  const usedBars = new Set<string>();
  const out: DatePlan[] = [];
  const template = rulesPlans[0];
  for (const p of result.picks) {
    const restaurant = bySlug.get(p.slug);
    if (!restaurant) continue;
    const prior = fromRules.get(p.slug);
    let bar = p.then ? bySlug.get(p.then) : undefined;
    if (!bar || usedBars.has(bar.slug) || haversineMeters(restaurant, bar) > 1400) bar = prior?.bar && !usedBars.has(prior.bar.slug) ? prior.bar : nearestBar(restaurant, bars, usedBars);
    if (!bar) continue;
    usedBars.add(bar.slug);
    let label: PickLabel = out.length === 0 ? "The pick" : p.label && !taken.has(p.label) ? p.label : prior?.label && !taken.has(prior.label) ? prior.label : nextLabel(taken);
    if (out.length > 0 && label === "The pick") label = nextLabel(taken);
    taken.add(label);
    const dist = haversineMeters(restaurant, bar);
    const walk = Math.max(2, Math.round(dist / 80));
    const dinnerAt = prior?.dinnerAt ?? template?.dinnerAt;
    const drinksAt = prior?.drinksAt ?? template?.drinksAt ?? (dinnerAt ?? 20) + 1.75;
    out.push({ restaurant, bar, label, score: prior?.score ?? 0.5, dinnerAt, drinksAt, walkMinutes: walk, why: p.why || prior?.why || "" });
  }
  return (out.length ? out : rulesPlans).slice(0, count);
}

/** Bars-only plans (a date without dinner): reorder like night picks but keep the DatePlan shape. */
export function applyToBarPlans(result: PickResult, rulesPlans: DatePlan[], venues: Venue[], count = 6): DatePlan[] {
  const fromRules = new Map(rulesPlans.map((p) => [p.bar.slug, p]));
  if (result.engine !== "claude") return result.picks.map((p) => fromRules.get(p.slug)).filter((p): p is DatePlan => !!p).slice(0, count);
  const bySlug = new Map(venues.map((v) => [v.slug, v]));
  const taken = new Set<PickLabel>();
  const out: DatePlan[] = [];
  const template = rulesPlans[0];
  for (const p of result.picks) {
    const bar = bySlug.get(p.slug);
    if (!bar) continue;
    const prior = fromRules.get(p.slug);
    let label: PickLabel = out.length === 0 ? "The pick" : p.label && !taken.has(p.label) ? p.label : prior?.label && !taken.has(prior.label) ? prior.label : nextLabel(taken);
    if (out.length > 0 && label === "The pick") label = nextLabel(taken);
    taken.add(label);
    out.push({ bar, label, score: prior?.score ?? 0.5, drinksAt: prior?.drinksAt ?? template?.drinksAt ?? 21, why: p.why || prior?.why || "" });
  }
  return (out.length ? out : rulesPlans).slice(0, count);
}

function nextLabel(taken: Set<PickLabel>): PickLabel {
  return LABELS.find((l) => !taken.has(l)) ?? "Wildcard";
}

function nearestBar(from: Venue, bars: Venue[], used: Set<string>): Venue | undefined {
  return bars
    .filter((b) => !used.has(b.slug))
    .map((b) => ({ b, d: haversineMeters(from, b) }))
    .sort((a, b) => a.d - b.d)[0]?.b;
}
