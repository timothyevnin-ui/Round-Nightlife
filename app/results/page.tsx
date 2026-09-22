import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { recommendDate, recommendNight } from "@/lib/engine";
import { isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { encodePlan, type PlanPayload } from "@/lib/plan";
import { formatHour } from "@/lib/time";
import type { DateStage, DateVibe, Vibe } from "@/lib/types";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = { title: "Tonight" };

const VIBES: Vibe[] = ["lively", "chill", "talk"];
const DATE_VIBES: DateVibe[] = ["talk", "lowlit", "lively"];
const STAGES: DateStage[] = ["first", "early", "longterm"];

function num(x: string | string[] | undefined, fallback: number) {
  const n = Number(Array.isArray(x) ? x[0] : x);
  return Number.isFinite(n) ? n : fallback;
}
function str(x: string | string[] | undefined) {
  return Array.isArray(x) ? x[0] : x;
}

export default async function ResultsPage(props: PageProps<"/results">) {
  const sp = await props.searchParams;
  const mode = str(sp.m) === "date" ? "date" : "night";
  const n = str(sp.n);
  if (!isNeighborhoodId(n)) redirect(`/plan/${mode}`);
  const hour = num(sp.t, 21);
  const dow = num(sp.d, new Date().getDay());

  if (mode === "night") {
    const vibe = (VIBES.includes(str(sp.v) as Vibe) ? str(sp.v) : "lively") as Vibe;
    const group = Math.min(11, Math.max(2, num(sp.g, 4)));
    const picks = recommendNight({ neighborhood: n, vibe, group, hour, dow });
    const payload: PlanPayload = { m: "night", n, t: hour, g: group, s: picks.map((p) => ({ bar: p.venue.slug })) };
    const code = encodePlan(payload);
    const perCard = picks.map((p) => encodePlan({ ...payload, s: [{ bar: p.venue.slug }] }));
    const summary = [neighborhoodName(n), { lively: "Lively", chill: "Chill", talk: "Can actually talk" }[vibe], group === 11 ? "11+" : `${group} of you`, formatHour(hour, true)];
    return (
      <ResultsView
        mode="night"
        summary={summary}
        editHref="/plan/night"
        code={code}
        night={picks.map((p, i) => ({ ...p, shareCode: perCard[i] }))}
      />
    );
  }

  const stage = (STAGES.includes(str(sp.s) as DateStage) ? str(sp.s) : "early") as DateStage;
  const dinner = str(sp.dn) !== "0";
  const vibe = (DATE_VIBES.includes(str(sp.v) as DateVibe) ? str(sp.v) : "talk") as DateVibe;
  const plans = recommendDate({ neighborhood: n, stage, dinner, vibe, hour, dow });
  const payload: PlanPayload = {
    m: "date",
    n,
    t: hour,
    s: plans.map((p) => ({
      restaurant: p.restaurant?.slug,
      bar: p.bar.slug,
      dinnerAt: p.dinnerAt,
      drinksAt: p.drinksAt,
      walk: p.walkMinutes,
    })),
  };
  const code = encodePlan(payload);
  const perCard = plans.map((_, i) => encodePlan({ ...payload, s: [payload.s[i]] }));
  const summary = [
    neighborhoodName(n),
    { first: "First date", early: "A few dates in", longterm: "Long-term" }[stage],
    dinner ? "Dinner + drinks" : "Drinks",
    formatHour(hour, true),
  ];
  return (
    <ResultsView
      mode="date"
      summary={summary}
      editHref="/plan/date"
      code={code}
      date={plans.map((p, i) => ({ ...p, shareCode: perCard[i] }))}
    />
  );
}
