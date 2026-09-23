import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { interpretPrompt, interpretText, type Interpretation } from "@/lib/interpret";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import { ATTR_KEYS } from "@/lib/attrs";
import { getVenues } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ROUND_TEXT_MODEL ?? process.env.ROUND_VISION_MODEL ?? "claude-haiku-4-5-20251001";

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
    after(() => logEvent({ kind: "sayit", q: text, slug: i.venue?.slug ?? null, data: { engine, mode: i.mode, neighborhood: i.neighborhood ?? null, near: !!i.near, wants: Object.keys(i.wants), understood: i.understood } }));
  if (!key) {
    log(keyword, "keywords");
    return NextResponse.json({ interpretation: keyword, engine: "keywords" });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: interpretPrompt(text, forMatch) }],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Partial<Omit<Interpretation, "venue">> & { venue?: string | null; near?: boolean };
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
    };
    if (venue && !isNeighborhoodId(json.neighborhood)) merged.neighborhood = venue.neighborhood;
    if (venue && !merged.understood.some((u) => u.toLowerCase().includes(venue.name.toLowerCase()))) merged.understood = [near ? `near ${venue.name}` : venue.name, ...merged.understood].slice(0, 7);
    log(merged, "claude");
    return NextResponse.json({ interpretation: merged, engine: "claude" });
  } catch (e) {
    console.error("[interpret] model failed, using keywords", e);
    log(keyword, "keywords-fallback");
    return NextResponse.json({ interpretation: keyword, engine: "keywords" });
  }
}
