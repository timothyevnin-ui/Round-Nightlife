import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { VENUES } from "@/lib/venues";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST multipart/form-data with `images[]` (screenshots of TikToks, Reels,
 * texts, articles). Claude reads each one and returns the place it's about,
 * matched to ROUND's database when possible. Unmatched places are returned
 * too — they're the curation inbox.
 */

const MODEL = process.env.ROUND_VISION_MODEL ?? "claude-haiku-4-5";
const MAX_FILES = 10;
const MAX_BYTES = 6 * 1024 * 1024;

type Reading = {
  index: number;
  name: string | null;
  neighborhood: string | null;
  creator: string | null;
  slug: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
};

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "no_key", message: "Set ANTHROPIC_API_KEY to let ROUND read screenshots." },
      { status: 501 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const files = form.getAll("images").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (files.length === 0) return NextResponse.json({ error: "no_images" }, { status: 400 });

  const client = new Anthropic({ apiKey: key });
  const catalog = VENUES.map((v) => `${v.slug} | ${v.name} | ${v.neighborhood}`).join("\n");
  const hoods = NEIGHBORHOODS.map((n) => n.id).join(", ");

  const readings = await Promise.all(
    files.map(async (file, index): Promise<Reading> => {
      if (file.size > MAX_BYTES) return { index, name: null, neighborhood: null, creator: null, slug: null, confidence: "low", note: "Too large" };
      const buf = Buffer.from(await file.arrayBuffer());
      const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ? file.type : "image/jpeg") as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "image/gif";
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 300,
          system:
            "You read screenshots of TikToks, Instagram posts, text messages and articles about bars and restaurants in New York City. " +
            "Extract the single place the screenshot is about. Use caption text, on-screen text, location tags and creator handles. " +
            "Never guess a place that isn't evidenced in the image. Respond with JSON only.",
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } },
                {
                  type: "text",
                  text:
                    `Return JSON: {"name": string|null, "neighborhood": one of [${hoods}] or null, "creator": handle|null, ` +
                    `"slug": matching slug from the catalog or null, "confidence": "high"|"medium"|"low", "note": short string|null}.\n` +
                    `Catalog (slug | name | neighborhood):\n${catalog}`,
                },
              ],
            },
          ],
        });
        const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<Reading>;
        const slug = json.slug && VENUES.some((v) => v.slug === json.slug) ? json.slug : null;
        return {
          index,
          name: json.name ?? null,
          neighborhood: json.neighborhood ?? null,
          creator: json.creator ?? null,
          slug,
          confidence: json.confidence ?? "low",
          note: json.note ?? null,
        };
      } catch (e) {
        return { index, name: null, neighborhood: null, creator: null, slug: null, confidence: "low", note: e instanceof Error ? e.message : "Could not read" };
      }
    }),
  );

  return NextResponse.json({ readings });
}
