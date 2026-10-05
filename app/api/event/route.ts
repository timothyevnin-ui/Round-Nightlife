import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isEventKind, logEvent } from "@/lib/events";
import { CROWD_TAG } from "@/lib/crowd";

export const runtime = "nodejs";

/**
 * POST { kind, slug?, q?, data? } from the app. Anonymous. Always answers
 * 204: logging is best-effort and never a reason to show anyone an error.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { kind?: unknown; slug?: unknown; q?: unknown; data?: unknown };
    if (!isEventKind(body.kind)) return new NextResponse(null, { status: 204 });
    // A rating (V32): the place's page and the crowd reads refresh once the write has landed, so the person sees their own line.
    if (body.kind === "save" && typeof body.slug === "string" && body.data && typeof body.data === "object" && (body.data as { source?: unknown }).source === "rate") {
      const slug = body.slug.slice(0, 80);
      after(async () => {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          revalidateTag(CROWD_TAG, "max");
          revalidatePath(`/v/${slug}`);
        } catch (e) {
          console.warn("[event] couldn't refresh the page after a rating", e instanceof Error ? e.message : e);
        }
      });
    }
    await logEvent({
      kind: body.kind,
      slug: typeof body.slug === "string" ? body.slug : null,
      q: typeof body.q === "string" ? body.q : null,
      data: body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {},
    });
  } catch {
    /* ignore */
  }
  return new NextResponse(null, { status: 204 });
}
