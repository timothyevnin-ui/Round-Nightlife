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
 * The card that shows when someone texts a place: the photo, the name, where
 * and what it is, the score, and ROUND's take. Paper, ink, a tomato ring.
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
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, background: "#f3ede0", color: "#16213a" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, border: "9px solid #d9482b" }} />
          <div style={{ fontFamily: "Instrument Serif", fontSize: 96, letterSpacing: 16 }}>ROUND</div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const kind = v.kind === "restaurant" ? v.cuisine || "Restaurant" : v.barFood ? "Bar with a kitchen" : "Bar";
  const meta = `${neighborhoodName(v.neighborhood)}  ·  ${kind}  ·  ${"$".repeat(v.price)}`;
  const take = v.take.length > 150 ? `${v.take.slice(0, 147).replace(/\s+\S*$/, "")}…` : v.take;
  const nameSize = v.name.length > 22 ? 62 : v.name.length > 14 ? 76 : 92;
  const score = typeof v.score === "number" ? v.score : null;
  const r = 52;
  const c = 2 * Math.PI * r;
  const { from, to, angle = 160 } = v.photo;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3ede0", color: "#16213a", fontFamily: "Geist" }}>
        <div style={{ width: 470, height: "100%", display: "flex", position: "relative", background: `linear-gradient(${angle}deg, ${from}, ${to})` }}>
          {photo && (
            <img src={photo} alt="" width={470} height={630} style={{ width: 470, height: 630, objectFit: "cover" }} />
          )}
          <div style={{ position: "absolute", left: 0, top: 0, width: 470, height: 630, background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
          {v.verified && (
            <div style={{ position: "absolute", left: 28, bottom: 28, display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 999, background: "rgba(243,237,224,0.92)", color: "#16213a", fontSize: 20, letterSpacing: 2 }}>
              <div style={{ width: 14, height: 14, borderRadius: 999, background: "#d9482b" }} />
              {v.sources?.[0] === "desk" ? "CHECKED BY ROUND" : "ROUND HAS BEEN"}
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 56px 44px 52px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, border: "5px solid #d9482b" }} />
              <div style={{ fontFamily: "Instrument Serif", fontSize: 36, letterSpacing: 7 }}>ROUND</div>
            </div>
            {score !== null && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: 124, height: 124 }}>
                <svg width="124" height="124" viewBox="0 0 124 124" style={{ position: "absolute", left: 0, top: 0 }}>
                  <circle cx="62" cy="62" r={r} stroke="rgba(22,33,58,0.12)" strokeWidth="9" fill="none" />
                  <circle cx="62" cy="62" r={r} stroke={score >= 90 ? "#d9482b" : score >= 75 ? "#143327" : "#16213a"} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 62 62)" />
                </svg>
                <div style={{ fontFamily: "Instrument Serif", fontSize: 52, lineHeight: 1 }}>{score}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "Instrument Serif", fontSize: nameSize, lineHeight: 1.02, letterSpacing: -1.5, display: "flex" }}>{v.name}</div>
            <div style={{ fontSize: 24, letterSpacing: 1, color: "rgba(22,33,58,0.6)", display: "flex" }}>{meta}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 19, letterSpacing: 4, color: "#d9482b" }}>ROUND SAYS</div>
            <div style={{ fontFamily: "Instrument Serif", fontSize: 32, lineHeight: 1.22, color: "rgba(22,33,58,0.86)", display: "flex" }}>{take}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
