import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ROUND: where should we go tonight?";

async function font(file: string) {
  return readFile(path.join(process.cwd(), "app", "fonts", "og", file));
}

/** The card for the front door and any page without its own: the mark, the question. */
export default async function Image() {
  const [serif, sans] = await Promise.all([font("InstrumentSerif-Regular.woff"), font("Geist-Medium.ttf")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(160deg, #f3ede0 0%, #e6dcc6 140%)", color: "#16213a", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, border: "6px solid #d9482b" }} />
          <div style={{ fontFamily: "Instrument Serif", fontSize: 46, letterSpacing: 9 }}>ROUND</div>
        </div>
        <div style={{ fontFamily: "Instrument Serif", fontSize: 128, lineHeight: 1, letterSpacing: -3, display: "flex", flexDirection: "column" }}>
          <div>Where should</div>
          <div>we go tonight?</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 28, color: "rgba(22,33,58,0.7)" }}>Bars and restaurants in New York, one person&apos;s word on each.</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 64, padding: "0 34px", borderRadius: 999, background: "#16213a", color: "#f3ede0", fontSize: 24, letterSpacing: 3 }}>JUST SAY IT</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
        { name: "Geist", data: sans, weight: 500, style: "normal" },
      ],
    },
  );
}
