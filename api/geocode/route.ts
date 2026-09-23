import { NextResponse } from "next/server";

/**
 * Address → coordinates, biased to New York, via OpenStreetMap's Nominatim.
 * Server-side so the app never hands a third party the user's IP. Light use
 * only (Nominatim asks for ≤1 request/second); results are cached an hour.
 */
export const revalidate = 3600;

const NYC_BOX = "-74.05,40.68,-73.90,40.80"; // west,south,east,north (lower Manhattan + north Brooklyn, roomy)

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ error: "Type an address or a cross street." }, { status: 400 });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", /new york|brooklyn|manhattan|ny\b/i.test(q) ? q : `${q}, New York, NY`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("viewbox", NYC_BOX);
  url.searchParams.set("bounded", "1");
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ROUND (round-nightlife.vercel.app)", "Accept-Language": "en" }, next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "Couldn't look that up right now." }, { status: 502 });
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = rows[0];
    if (!hit) return NextResponse.json({ error: "Couldn't find that in the neighborhoods ROUND covers yet." }, { status: 404 });
    const label = hit.display_name.split(",").slice(0, 2).join(",").trim();
    return NextResponse.json({ lat: Number(hit.lat), lng: Number(hit.lon), label });
  } catch {
    return NextResponse.json({ error: "Couldn't look that up right now." }, { status: 502 });
  }
}
