import { NextResponse } from "next/server";
import { after } from "next/server";
import { getVenue } from "@/lib/db";
import { bestQuestion, chooseQuestions, knownPercent } from "@/lib/crowdQuestions";
import { coverageFor, getPoolAll, writeQuestionFor } from "@/lib/pool";
import { getSettings } from "@/lib/settings";

/**
 * What to ask about one place (V32): the Best-for question for its kind and
 * ROUND's questions for it, in the order the sheet should ask them, plus
 * how well ROUND knows the place. `done` is the question ids this person
 * already answered here (from their phone), never asked twice. If no
 * question has been written for this place yet, one is written in the
 * background for the next person.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().slice(0, 80);
  if (!slug) return NextResponse.json({ error: "slug" }, { status: 400 });
  const v = await getVenue(slug);
  if (!v) return NextResponse.json({ error: "no such place" }, { status: 404 });
  const done = (url.searchParams.get("done") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 40);
  // The pool is read fresh here (it's a few dozen rows): a question written a second ago is asked now, not in a minute.
  const [{ pool: whole }, coverage, { barsOnly }] = await Promise.all([getPoolAll(true), coverageFor(slug), getSettings()]);
  const pool = whole.filter((q) => q.active && (!barsOnly || q.kind !== "restaurant"));
  const best = bestQuestion(pool, v.kind);
  const asks = chooseQuestions(pool, v.kind, slug, coverage, done);
  const known = knownPercent(pool, v.kind, slug, coverage);
  if (!pool.some((q) => q.slug === slug) && process.env.ANTHROPIC_API_KEY) {
    after(async () => {
      try {
        await writeQuestionFor(v);
      } catch (e) {
        console.warn("[rate-questions] couldn't write a question for", slug, e instanceof Error ? e.message : e);
      }
    });
  }
  return NextResponse.json({ best: best ?? null, asks, known, kind: v.kind }, { headers: { "Cache-Control": "no-store" } });
}
