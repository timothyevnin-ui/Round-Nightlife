import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVenue } from "@/lib/db";
import { neighborhoodName } from "@/lib/neighborhoods";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A place on ROUND";

async function font(file: string) {
  return readFile(path.join(process.cwd(), "app", "fonts", "og", file));
}

/** The place's photo as a data URL, so the card never depends on a third host answering later. */
async function photoData(url?: string): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png|webp)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The card that shows when someone texts a place (V33, at night): the photo
 * full-bleed with the name over its foot, and ROUND's take on a cream card
 * beside it with the ring. Night, cream, tomato.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getVenue(slug);
  const [serif, sans] = await Promise.all([font("InstrumentSerif-Regular.woff"), font("Geist-Medium.ttf")]);
  const photo = v && !v.retired ? await photoData(v.photoUrl) : null;
  const fonts = [
    { name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: sans, weight: 500 as const, style: "normal" as const },
  ];

  if (!v || v.retired) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, background: "#0e1730", color: "#f6f1e7" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, border: "9px solid #d9482b" }} />
          <div style={{ fontFamily: "Instrument Serif", fontSize: 96, letterSpacing: 16 }}>ROUND</div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const kind = v.kind === "restaurant" ? v.cuisine || "Restaurant" : v.barFood ? "Bar with a kitchen" : "Bar";
  const meta = `${neighborhoodName(v.neighborhood)} · ${kind} · ${"$".repeat(v.price)}`;
  const take = v.take.length > 130 ? `${v.take.slice(0, 127).replace(/\s+\S*$/, "")}…` : v.take;
  const nameSize = v.name.length > 22 ? 54 : v.name.length > 14 ? 66 : 80;
  const score = typeof v.score === "number" ? v.score : null;
  const r = 52;
  const c = 2 * Math.PI * r;
  const { from, to, angle = 160 } = v.photo;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e1730", color: "#f6f1e7", fontFamily: "Geist" }}>
        <div style={{ width: 560, height: "100%", display: "flex", position: "relative", background: `linear-gradient(${angle}deg, ${from}, ${to})` }}>
          {photo && <img src={photo} alt="" width={560} height={630} style={{ width: 560, height: 630, objectFit: "cover" }} />}
          <div style={{ position: "absolute", left: 0, top: 0, width: 560, height: 630, background: "linear-gradient(180deg, rgba(14,23,48,0.1) 0%, rgba(14,23,48,0) 35%, rgba(14,23,48,0.9) 78%, #0e1730 100%)" }} />
          <div style={{ position: "absolute", left: 36, right: 36, bottom: 34, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 16, letterSpacing: 3, color: "rgba(246,241,231,0.72)", display: "flex" }}>{meta.toUpperCase()}</div>
            <div style={{ fontFamily: "Instrument Serif", fontSize: nameSize, lineHeight: 0.98, letterSpacing: -1.5, display: "flex", color: "#f6f1e7" }}>{v.name}</div>
            {v.verified && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, letterSpacing: 2, color: "rgba(246,241,231,0.75)" }}>
                <div style={{ width: 14, height: 14, borderRadius: 999, background: "#d9482b" }} />
                {v.sources?.[0] === "desk" ? "CHECKED BY ROUND" : "ROUND HAS BEEN"}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "36px 40px 36px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, border: "4.5px solid #d9482b" }} />
            <div style={{ fontFamily: "Instrument Serif", fontSize: 32, letterSpacing: 7 }}>ROUND</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "#f6f1e7", color: "#16213a", borderRadius: 30, padding: "30px 32px 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div style={{ fontSize: 17, letterSpacing: 4, color: "#d9482b", paddingTop: 8 }}>ROUND SAYS</div>
              {score !== null && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: 96, height: 96 }}>
                  <svg width="96" height="96" viewBox="0 0 124 124" style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>
                    <circle cx="62" cy="62" r={r} stroke="rgba(22,33,58,0.12)" strokeWidth="9" fill="none" />
                    <circle cx="62" cy="62" r={r} stroke={score >= 85 ? "#d9482b" : score >= 70 ? "#1f4a3c" : "#16213a"} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 62 62)" />
                  </svg>
                  <div style={{ fontFamily: "Instrument Serif", fontSize: 40, lineHeight: 1, display: "flex" }}>{String(score)}</div>
                </div>
              )}
            </div>
            <div style={{ fontFamily: "Instrument Serif", fontSize: 31, lineHeight: 1.2, color: "#16213a", display: "flex", marginTop: score !== null ? -28 : 0, paddingRight: score !== null ? 96 : 0 }}>{take}</div>
          </div>
          <div style={{ fontSize: 18, letterSpacing: 2, color: "rgba(246,241,231,0.5)" }}>roundnyc.com</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
