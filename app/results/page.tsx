import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { logEvent } from "@/lib/events";
import { haversineMeters, isDaytime, recommendAround, recommendDate, recommendDinner, recommendNear, recommendNight, RESULT_COUNT } from "@/lib/engine";
import { getVenues } from "@/lib/db";
import { isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { applyToBarPlans, applyToNight, applyToPlans, pickWithClaude, type PickRequest, type PickResult } from "@/lib/pick";
import { encodePlan, type PlanPayload } from "@/lib/plan";
import { ipFrom } from "@/lib/ratelimit";
import { parseFav, parseName, parseTaste } from "@/lib/taste";
import { FAV_COOKIE, NAME_COOKIE, TASTE_COOKIE } from "@/lib/tasteCookie";
import { decodeWants, describeWants } from "@/lib/questions";
import { formatHour } from "@/lib/time";
import type { DatePlan, DateStage, Mode, NightPick } from "@/lib/types";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = { title: "Tonight" };
// Claude gets a few seconds to read the room; the rules engine answers if it's slow.
export const maxDuration = 30;

const STAGES: DateStage[] = ["first", "early", "longterm"];

function num(x: string | string[] | undefined, fallback: number) {
  const n = Number(Array.isArray(x) ? x[0] : x);
  return Number.isFinite(n) ? n : fallback;
}
function str(x: string | string[] | undefined) {
  return Array.isArray(x) ? x[0] : x;
}
function groupWord(g: number) {
  return g >= 11 ? "11+ of you" : `${g} of you`;
}

function planStops(plans: DatePlan[]) {
  return plans.map((p) => ({ restaurant: p.restaurant?.slug, bar: p.bar.slug, dinnerAt: p.dinnerAt, drinksAt: p.drinksAt, walk: p.walkMinutes }));
}

/** The engine's picks beyond the six are the hint list for Claude; the first six are the answer without it. */
const HINTS = 12;

export default async function ResultsPage(props: PageProps<"/results">) {
  const sp = await props.searchParams;
  const m = str(sp.m);
  const hour = num(sp.t, 21);
  const dow = num(sp.d, new Date().getDay());
  const wants = decodeWants(str(sp.w));
  const been = (str(sp.b) ?? "").split(",").filter(Boolean);
  const said = (str(sp.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
  const venues = await getVenues();
  const wantChips = describeWants(wants);
  const shown = (mode: string, extra: Record<string, unknown>, slugs: string[], ai: PickResult) =>
    after(() =>
      logEvent({
        kind: "results",
        q: said ?? (wantChips.join(", ") || null),
        data: { mode, hour, dow, wants: Object.keys(wants), ...extra, shown: slugs.slice(0, 8), engine: ai.engine, model: ai.model ?? null, ms: ai.ms, heard: ai.heard ?? null, note: ai.note ?? null },
      }),
    );
  const ip = ipFrom(await headers());
  const jar = await cookies();
  const taste = parseTaste(jar.get(TASTE_COOKIE)?.value);
  const name = parseName(jar.get(NAME_COOKIE)?.value);
  const favorite = parseFav(jar.get(FAV_COOKIE)?.value);
  const base: Pick<PickRequest, "hour" | "dow" | "wants" | "been" | "said" | "ip" | "taste" | "name" | "favorite"> = { hour, dow, wants, been, said, ip, taste, name, favorite };

  if (m === "near") {
    const lat = num(sp.lat, NaN);
    const lng = num(sp.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) redirect("/near");
    const at = str(sp.at);
    const n = str(sp.n);
    // "Near Bayard's": Bayard's itself is where they are, not a pick.
    const standingAt = at ? venues.find((v) => v.name.toLowerCase() === at.toLowerCase() && haversineMeters({ lat, lng }, v) < 60)?.slug : undefined;
    const twelve = recommendNear({ lat, lng, hour, dow, wants, exclude: standingAt }, venues, HINTS);
    const ai = await pickWithClaude(
      { ...base, mode: "near", place: { label: at ?? "here", lat, lng, slug: standingAt }, neighborhood: isNeighborhoodId(n) ? n : twelve[0]?.venue.neighborhood, group: num(sp.g, 0) || undefined },
      venues,
      twelve.map((p) => ({ slug: p.venue.slug })),
    );
    const bySlug = new Map(twelve.map((p) => [p.venue.slug, p]));
    const picks = applyToNight(ai, twelve, venues).map((p) => {
      const near = bySlug.get(p.venue.slug);
      const meters = near?.meters ?? Math.round(haversineMeters({ lat, lng }, p.venue));
      const walk = near?.walkMinutes ?? Math.max(1, Math.round(meters / 80));
      const why = p.why || near?.why || "";
      return { ...p, meters, walkMinutes: walk, why: /min walk/.test(why) ? why : [`${walk} min walk`, why].filter(Boolean).join(" · ") };
    });
    const payload: PlanPayload = { m: "night", n: picks[0]?.venue.neighborhood ?? "west-village", t: hour, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    shown("near", { at: at ?? null }, picks.map((p) => p.venue.slug), ai);
    const summary = [at ? `Near ${at}` : "Near you", formatHour(hour, true), ...wantChips];
    return <ResultsView mode="near" summary={summary} heard={ai.heard} day={isDaytime(hour)} editHref="/near" code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  const anchor = venues.find((v) => v.slug === str(sp.a));
  if (anchor) {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const twelve = recommendAround(anchor, { neighborhood: anchor.neighborhood, group, hour, dow, wants, been }, venues, HINTS);
    const lead = twelve[0];
    const rest = twelve.slice(1);
    const ai = await pickWithClaude({ ...base, mode: "around", anchor, neighborhood: anchor.neighborhood, group }, venues, rest.map((p) => ({ slug: p.venue.slug })), RESULT_COUNT - 1);
    const picks: NightPick[] = applyToNight(ai, rest, venues, lead, RESULT_COUNT);
    const payload: PlanPayload = { m: "night", n: anchor.neighborhood, t: hour, g: group, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    shown("around", { anchor: anchor.slug, neighborhood: anchor.neighborhood, group }, picks.map((p) => p.venue.slug), ai);
    const summary = [anchor.name, neighborhoodName(anchor.neighborhood), groupWord(group), formatHour(hour, true), ...wantChips];
    return <ResultsView mode="night" summary={summary} heard={ai.heard} day={isDaytime(hour)} editHref="/plan/night" code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  const mode: Mode = m === "date" ? "date" : m === "dinner" ? "dinner" : "night";
  const dayDoor = m === "day";
  const n = str(sp.n);
  if (!isNeighborhoodId(n)) redirect(dayDoor ? "/plan/day" : `/plan/${mode}`);

  if (mode === "night") {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const twelve = recommendNight({ neighborhood: n, group, hour, dow, wants, been }, venues, HINTS);
    const ai = await pickWithClaude({ ...base, mode: "night", neighborhood: n, group }, venues, twelve.map((p) => ({ slug: p.venue.slug })));
    const picks = applyToNight(ai, twelve, venues);
    const payload: PlanPayload = { m: "night", n, t: hour, g: group, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    shown(dayDoor ? "day" : "night", { neighborhood: n, group }, picks.map((p) => p.venue.slug), ai);
    const summary = [neighborhoodName(n), groupWord(group), formatHour(hour, true), ...wantChips];
    return <ResultsView mode="night" title={dayDoor ? "Day out" : undefined} summary={summary} heard={ai.heard} day={isDaytime(hour)} editHref={dayDoor ? "/plan/day" : "/plan/night"} code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  const bars = venues.filter((v) => v.kind === "bar");

  if (mode === "dinner") {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const twelve = recommendDinner({ neighborhood: n, group, hour, dow, wants, been }, venues, HINTS);
    const ai = await pickWithClaude({ ...base, mode: "dinner", neighborhood: n, group }, venues, twelve.map((p) => ({ slug: p.restaurant?.slug ?? p.bar.slug, then: p.restaurant ? p.bar.slug : undefined })));
    const plans = applyToPlans(ai, twelve, venues, bars);
    const payload: PlanPayload = { m: "dinner", n, t: hour, g: group, s: planStops(plans) };
    const code = encodePlan(payload);
    const perCard = plans.map((_, i) => encodePlan({ ...payload, s: [payload.s[i]] }));
    shown("dinner", { neighborhood: n, group }, plans.map((p) => p.bar.slug), ai);
    const summary = [neighborhoodName(n), groupWord(group), `Dinner ${formatHour(hour, true)}`, ...wantChips];
    return <ResultsView mode="dinner" summary={summary} heard={ai.heard} editHref="/plan/dinner" code={code} plans={plans.map((p, i) => ({ ...p, shareCode: perCard[i] }))} groupWord={groupWord(group)} />;
  }

  const stage = (STAGES.includes(str(sp.s) as DateStage) ? str(sp.s) : "early") as DateStage;
  const dinner = str(sp.dn) !== "0";
  const twelve = recommendDate({ neighborhood: n, stage, dinner, hour, dow, wants, been }, venues, HINTS);
  const ai = await pickWithClaude({ ...base, mode: "date", neighborhood: n, stage, dinner, group: 2 }, venues, twelve.map((p) => ({ slug: p.restaurant?.slug ?? p.bar.slug, then: p.restaurant ? p.bar.slug : undefined })));
  const plans = dinner ? applyToPlans(ai, twelve, venues, bars) : applyToBarPlans(ai, twelve, venues);
  const payload: PlanPayload = { m: "date", n, t: hour, s: planStops(plans) };
  const code = encodePlan(payload);
  const perCard = plans.map((_, i) => encodePlan({ ...payload, s: [payload.s[i]] }));
  shown("date", { neighborhood: n, stage, dinner }, plans.map((p) => p.bar.slug), ai);
  const summary = [neighborhoodName(n), { first: "First date", early: "A few dates in", longterm: "Long-term" }[stage], dinner ? "Dinner + drinks" : "Drinks", formatHour(hour, true), ...wantChips];
  return <ResultsView mode="date" summary={summary} heard={ai.heard} editHref="/plan/date" code={code} plans={plans.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
}
