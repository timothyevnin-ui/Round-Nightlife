import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

/**
 * Anywhere in the city → a point, for Near me. Server-side so the app never
 * hands a third party the user's IP. See lib/geocode.ts for the how.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ error: "Type an address, a place, or a cross street." }, { status: 400 });
  const hit = await geocode(q);
  if (!hit) return NextResponse.json({ error: "Couldn't find that in the neighborhoods ROUND covers yet. Try the street address." }, { status: 404 });
  return NextResponse.json(hit);
}
