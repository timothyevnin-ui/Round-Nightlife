import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolvePlace, suggestPlaces } from "@/lib/placesSearch";
import { ipFrom, takeToken } from "@/lib/ratelimit";

/**
 * Type-ahead for bars and addresses (V35). `?q=red li&s=<session>` answers
 * with matches; `?id=<id>&s=<session>` resolves a pick to its name, address
 * and pin. The provider key never leaves the server, and each phone gets a
 * budget so a stuck key can't run up a bill.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ip = ipFrom(await headers());
  if (!takeToken(`places:${ip ?? "unknown"}`, 60)) return NextResponse.json({ hits: [] }, { status: 429 });
  const session = (sp.get("s") ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || undefined;
  const id = sp.get("id");
  if (id) {
    const place = await resolvePlace(id.slice(0, 400), session).catch(() => null);
    return NextResponse.json(place ? { place } : { error: "Couldn't place that one. Type the address instead." }, { status: place ? 200 : 404 });
  }
  const q = sp.get("q") ?? "";
  const hits = await suggestPlaces(q, session).catch(() => []);
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
