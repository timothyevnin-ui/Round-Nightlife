import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { interpretPrompt, interpretText, type Interpretation } from "@/lib/interpret";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import { ATTR_KEYS } from "@/lib/attrs";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ROUND_TEXT_MODEL ?? process.env.ROUND_VISION_MODEL ?? "claude-haiku-4-5";

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

  const keyword = interpretText(text);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ interpretation: keyword, engine: "keywords" });

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: interpretPrompt(text) }],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Partial<Interpretation>;
    const wants: Interpretation["wants"] = {};
    for (const [k, v] of Object.entries(json.wants ?? {})) {
      if ((ATTR_KEYS as readonly string[]).includes(k) || k === "noLine" || k === "new") {
        const n = Number(v);
        if (Number.isFinite(n) && n !== 0) wants[k as keyof Interpretation["wants"]] = Math.max(-1, Math.min(1, n));
      }
    }
    const merged: Interpretation = {
      mode: json.mode === "date" ? "date" : keyword.mode,
      neighborhood: isNeighborhoodId(json.neighborhood) ? json.neighborhood : keyword.neighborhood,
      group: typeof json.group === "number" && json.group >= 2 ? Math.min(11, Math.round(json.group)) : keyword.group,
      hour: typeof json.hour === "number" && json.hour >= 12 && json.hour <= 28 ? json.hour : keyword.hour,
      stage: json.stage && ["first", "early", "longterm"].includes(json.stage) ? json.stage : keyword.stage,
      dinner: typeof json.dinner === "boolean" ? json.dinner : keyword.dinner,
      wants: Object.keys(wants).length ? wants : keyword.wants,
      understood: Array.isArray(json.understood) && json.understood.length ? json.understood.map(String).slice(0, 7) : keyword.understood,
    };
    return NextResponse.json({ interpretation: merged, engine: "claude" });
  } catch (e) {
    console.error("[interpret] model failed, using keywords", e);
    return NextResponse.json({ interpretation: keyword, engine: "keywords" });
  }
}
