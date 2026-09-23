import { NextResponse } from "next/server";
import { isEventKind, logEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * POST { kind, slug?, q?, data? } from the app. Anonymous. Always answers
 * 204: logging is best-effort and never a reason to show anyone an error.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { kind?: unknown; slug?: unknown; q?: unknown; data?: unknown };
    if (!isEventKind(body.kind)) return new NextResponse(null, { status: 204 });
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
