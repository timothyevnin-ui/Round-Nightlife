"use client";

import { motion } from "motion/react";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import type { NeighborhoodId } from "@/lib/types";

/**
 * A stylized, tappable map of the parts of New York ROUND covers: lower
 * Manhattan and north Brooklyn, drawn as simple shapes, each neighborhood a
 * region you tap. Hand-traced from approximate coordinates; it's a diagram,
 * not a chart.
 */

type LngLat = [number, number];

// Projection: lng → x, lat → y (flipped), with a cos(lat) squeeze on x.
const LNG0 = -74.022;
const LAT0 = 40.762;
const K = 5200;
const X = (lng: number) => (lng - LNG0) * K * 0.76;
const Y = (lat: number) => (LAT0 - lat) * K;
const W = X(-73.93);
const H = Y(40.694);

const path = (pts: LngLat[]) => pts.map(([lng, lat], i) => `${i ? "L" : "M"}${X(lng).toFixed(1)} ${Y(lat).toFixed(1)}`).join(" ") + " Z";

const MANHATTAN: LngLat[] = [
  [-74.017, 40.7], [-74.008, 40.702], [-73.998, 40.708], [-73.978, 40.712], [-73.975, 40.719], [-73.973, 40.727],
  [-73.969, 40.738], [-73.97, 40.746], [-73.962, 40.756], [-73.958, 40.762], [-74.012, 40.762], [-74.013, 40.748],
  [-74.011, 40.74], [-74.01, 40.732], [-74.012, 40.725], [-74.016, 40.716], [-74.019, 40.708],
];

const BROOKLYN: LngLat[] = [
  [-73.961, 40.741], [-73.934, 40.741], [-73.932, 40.722], [-73.933, 40.708], [-73.94, 40.699], [-73.958, 40.694],
  [-73.978, 40.696], [-73.992, 40.699], [-74.0, 40.694], [-74.0, 40.706], [-73.99, 40.705], [-73.98, 40.707],
  [-73.968, 40.709], [-73.963, 40.716], [-73.966, 40.721], [-73.962, 40.729], [-73.958, 40.735],
];

const REGIONS: Record<NeighborhoodId, LngLat[]> = {
  chelsea: [[-74.011, 40.741], [-73.988, 40.741], [-73.985, 40.755], [-74.012, 40.756]],
  "west-village": [[-74.01, 40.727], [-73.996, 40.727], [-73.996, 40.741], [-74.011, 40.741]],
  "east-village": [[-73.991, 40.721], [-73.973, 40.721], [-73.972, 40.735], [-73.991, 40.735]],
  "lower-east-side": [[-73.994, 40.709], [-73.976, 40.712], [-73.974, 40.721], [-73.994, 40.721]],
  "soho-nolita": [[-74.006, 40.719], [-73.992, 40.719], [-73.992, 40.727], [-74.006, 40.727]],
  tribeca: [[-74.017, 40.708], [-74.002, 40.71], [-74.003, 40.72], [-74.016, 40.718]],
  williamsburg: [[-73.968, 40.703], [-73.939, 40.703], [-73.94, 40.722], [-73.967, 40.722]],
  greenpoint: [[-73.963, 40.722], [-73.936, 40.722], [-73.936, 40.739], [-73.961, 40.739]],
};

const LABEL_POS: Partial<Record<NeighborhoodId, LngLat>> = {
  chelsea: [-73.999, 40.748],
  "west-village": [-74.003, 40.734],
  "east-village": [-73.982, 40.728],
  "lower-east-side": [-73.984, 40.716],
  "soho-nolita": [-73.999, 40.723],
  tribeca: [-74.0095, 40.714],
  williamsburg: [-73.9535, 40.7125],
  greenpoint: [-73.9485, 40.7305],
};

export function NycMap({ value, onSelect }: { value?: NeighborhoodId; onSelect: (id: NeighborhoodId) => void }) {
  return (
    <svg viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`} className="w-full" role="group" aria-label="Neighborhoods" style={{ maxHeight: 420 }}>
      {/* Water */}
      <rect x="0" y="0" width={W} height={H} fill="var(--paper-2)" />
      {/* Land */}
      <path d={path(MANHATTAN)} fill="var(--surface)" stroke="var(--hairline-strong)" strokeWidth="1" strokeLinejoin="round" />
      <path d={path(BROOKLYN)} fill="var(--surface)" stroke="var(--hairline-strong)" strokeWidth="1" strokeLinejoin="round" />

      {/* Borough names */}
      <text x={X(-74.006)} y={Y(40.7585)} className="serif" fontSize="14" fill="var(--ink-35)" letterSpacing="2">
        MANHATTAN
      </text>
      <text x={X(-73.958)} y={Y(40.7005)} className="serif" fontSize="14" fill="var(--ink-35)" letterSpacing="2">
        BROOKLYN
      </text>

      {/* Regions */}
      {NEIGHBORHOODS.map((n) => {
        const selected = value === n.id;
        const d = path(REGIONS[n.id]);
        const [lx, ly] = LABEL_POS[n.id] ?? [n.center.lng, n.center.lat];
        return (
          <g key={n.id} onClick={() => onSelect(n.id)} style={{ cursor: "pointer" }} role="button" aria-pressed={selected} aria-label={n.name}>
            <motion.path
              d={d}
              initial={false}
              animate={{ fill: selected ? "#d9482b" : "rgba(22,33,58,0.09)", stroke: selected ? "#b0361d" : "rgba(22,33,58,0.35)" }}
              transition={{ duration: 0.25 }}
              strokeWidth={selected ? 2 : 1.2}
              strokeLinejoin="round"
              whileTap={{ scale: 0.97 }}
              style={{ transformOrigin: `${X(lx)}px ${Y(ly)}px` }}
            />
            <text
              x={X(lx)}
              y={Y(ly)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={n.short.length > 9 ? 9.5 : 11}
              fontWeight={600}
              fill={selected ? "#f6f1e7" : "#16213a"}
              style={{ pointerEvents: "none", fontFamily: "var(--font-sans)", letterSpacing: "0.02em" }}
            >
              {n.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
