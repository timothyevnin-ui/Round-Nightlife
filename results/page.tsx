import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { logEvent } from "@/lib/events";
import { recommendAround, recommendDate, recommendDinner, recommendNear, recommendNight } from "@/lib/engine";
import { getVenues } from "@/lib/db";
import { isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { encodePlan, type PlanPayload } from "@/lib/plan";
import { decodeWants, describeWants } from "@/lib/questions";
import { formatHour } from "@/lib/time";
import type { DatePlan, DateStage, Mode } from "@/lib/types";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = { title: "Tonight" };

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

export default async function ResultsPage(props: PageProps<"/results">) {
  const sp = await props.searchParams;
  const m = str(sp.m);
  const hour = num(sp.t, 21);
  const dow = num(sp.d, new Date().getDay());
  const wants = decodeWants(str(sp.w));
  const been = (str(sp.b) ?? "").split(",").filter(Boolean);
  const venues = await getVenues();
  const wantChips = describeWants(wants);
  const shown = (mode: string, extra: Record<string, unknown>, slugs: string[]) =>
    after(() => logEvent({ kind: "results", q: wantChips.join(", ") || null, data: { mode, hour, dow, wants: Object.keys(wants), ...extra, shown: slugs.slice(0, 8) } }));

  if (m === "near") {
    const lat = num(sp.lat, NaN);
    const lng = num(sp.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) redirect("/near");
    const picks = recommendNear({ lat, lng, hour, dow, wants }, venues, 8);
    const payload: PlanPayload = { m: "night", n: picks[0]?.venue.neighborhood ?? "west-village", t: hour, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    const at = str(sp.at);
    shown("near", { at: at ?? null }, picks.map((p) => p.venue.slug));
    const summary = [at ? `Near ${at}` : "Near you", formatHour(hour, true), ...wantChips];
    return <ResultsView mode="near" summary={summary} editHref="/near" code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  const anchor = venues.find((v) => v.slug === str(sp.a));
  if (anchor) {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const picks = recommendAround(anchor, { neighborhood: anchor.neighborhood, group, hour, dow, wants, been }, venues);
    const payload: PlanPayload = { m: "night", n: anchor.neighborhood, t: hour, g: group, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    shown("around", { anchor: anchor.slug, neighborhood: anchor.neighborhood, group }, picks.map((p) => p.venue.slug));
    const summary = [anchor.name, neighborhoodName(anchor.neighborhood), groupWord(group), formatHour(hour, true), ...wantChips];
    return <ResultsView mode="night" summary={summary} editHref="/plan/night" code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  const mode: Mode = m === "date" ? "date" : m === "dinner" ? "dinner" : "night";
  const n = str(sp.n);
  if (!isNeighborhoodId(n)) redirect(`/plan/${mode}`);

  if (mode === "night") {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const picks = recommendNight({ neighborhood: n, group, hour, dow, wants, been }, venues);
    const payload: PlanPayload = { m: "night", n, t: hour, g: group, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    shown("night", { neighborhood: n, group }, picks.map((p) => p.venue.slug));
    const summary = [neighborhoodName(n), groupWord(group), formatHour(hour, true), ...wantChips];
    return <ResultsView mode="night" summary={summary} editHref="/plan/night" code={code} night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
  }

  if (mode === "dinner") {
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const plans = recommendDinner({ neighborhood: n, group, hour, dow, wants, been }, venues);
    const payload: PlanPayload = { m: "dinner", n, t: hour, g: group, s: planStops(plans) };
    const code = encodePlan(payload);
    const perCard = plans.map((_, i) => encodePlan({ ...payload, s: [payload.s[i]] }));
    shown("dinner", { neighborhood: n, group }, plans.map((p) => p.bar.slug));
    const summary = [neighborhoodName(n), groupWord(group), `Dinner ${formatHour(hour, true)}`, ...wantChips];
    return <ResultsView mode="dinner" summary={summary} editHref="/plan/dinner" code={code} plans={plans.map((p, i) => ({ ...p, shareCode: perCard[i] }))} groupWord={groupWord(group)} />;
  }

  const stage = (STAGES.includes(str(sp.s) as DateStage) ? str(sp.s) : "early") as DateStage;
  const dinner = str(sp.dn) !== "0";
  const plans = recommendDate({ neighborhood: n, stage, dinner, hour, dow, wants, been }, venues);
  const payload: PlanPayload = { m: "date", n, t: hour, s: planStops(plans) };
  const code = encodePlan(payload);
  const perCard = plans.map((_, i) => encodePlan({ ...payload, s: [payload.s[i]] }));
  shown("date", { neighborhood: n, stage, dinner }, plans.map((p) => p.bar.slug));
  const summary = [neighborhoodName(n), { first: "First date", early: "A few dates in", longterm: "Long-term" }[stage], dinner ? "Dinner + drinks" : "Drinks", formatHour(hour, true), ...wantChips];
  return <ResultsView mode="date" summary={summary} editHref="/plan/date" code={code} plans={plans.map((p, i) => ({ ...p, shareCode: perCard[i] }))} />;
}
