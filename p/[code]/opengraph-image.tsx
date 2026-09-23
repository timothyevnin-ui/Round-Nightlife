import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodePlan } from "@/lib/plan";
import { getVenues } from "@/lib/db";
import { venueMap } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";
import { formatHour } from "@/lib/time";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tonight, from ROUND";

async function font(file: string) {
  return readFile(path.join(process.cwd(), "app", "fonts", "og", file));
}

/** The card that lands in the group chat. Chalk black, cobalt ring, the names in serif. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const plan = decodePlan(code, venueMap(await getVenues()));
  const [serif, sans] = await Promise.all([font("InstrumentSerif-Regular.woff"), font("Geist-Medium.ttf")]);

  const names = plan
    ? plan.stops.map((s) => (s.restaurant ? `${s.restaurant.name} → ${s.bar.name}` : s.bar.name))
    : ["Where should we go?"];
  const meta = plan
    ? `${neighborhoodName(plan.n)}  ·  ${formatHour(plan.t, true)}${plan.g ? `  ·  ${plan.g === 11 ? "11+" : plan.g} of you` : ""}`
    : "Three places. Pick one. Go.";
  const eyebrow = plan ? (plan.m !== "night" && plan.stops[0]?.restaurant ? "TONIGHT'S PLAN" : plan.stops.length > 1 ? "ROUND SAYS ONE OF THESE" : "ROUND SAYS") : "ROUND";
  const nameSize = names.length === 1 ? 104 : names.length === 2 ? 84 : 66;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(160deg, #f3ede0 0%, #e6dcc6 140%)",
          color: "#16213a",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, border: "5px solid #d9482b" }} />
            <div style={{ fontFamily: "Instrument Serif", fontSize: 40, letterSpacing: 8 }}>ROUND</div>
          </div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "rgba(22,33,58,0.55)" }}>{eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: names.length > 2 ? 4 : 10 }}>
          {names.map((n, i) => (
            <div
              key={i}
              style={{
                fontFamily: "Instrument Serif",
                fontSize: nameSize,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: i === 0 ? "#16213a" : "rgba(22,33,58,0.7)",
                display: "flex",
              }}
            >
              {n}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 28, color: "rgba(22,33,58,0.7)" }}>{meta}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 64,
              padding: "0 34px",
              borderRadius: 999,
              background: "#16213a",
              color: "#f3ede0",
              fontSize: 26,
              letterSpacing: 3,
            }}
          >
            TAP ONE. GO.
          </div>
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
