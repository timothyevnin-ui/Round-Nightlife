import type { DayHours, Hours, NeighborhoodId, Window } from "../types";
import { cleanHours, everyDay } from "../hours";
import type { SeedVenue } from "../normalize";
import { isNeighborhoodId } from "../neighborhoods";
import westVillage from "./west-village.json";
import eastVillage from "./east-village.json";
import lowerEastSide from "./lower-east-side.json";
import sohoNolita from "./soho-nolita.json";
import tribeca from "./tribeca.json";
import chelsea from "./chelsea.json";
import williamsburg from "./williamsburg.json";
import greenpoint from "./greenpoint.json";

/**
 * The researched places (V6): one JSON file per neighborhood, written from
 * public sources into ROUND's own words. Every entry is a draft
 * (`verified: false`) until someone from ROUND has been. Coordinates are
 * estimated from the street address; "Find" in the back office pins exactly.
 */

type Researched = {
  slug: string;
  kind: "bar" | "restaurant";
  name: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  take: string;
  theCatch?: string;
  tags: string[];
  vibe: { lively: number; chill: number; talk: number };
  attrs?: Record<string, number>;
  groupFit: { two: number; small: number; mid: number; big: number };
  dateFit: { first: number; early: number; longterm: number };
  price: number;
  capacity: string;
  bestWindows: string;
  easyIn: number;
  sources?: string[];
  notes?: string;
  /** Posted hours: 7 entries Sunday-first, {open, close} or null; or "every": {open, close} for the same every night. */
  hours?: (DayHours | undefined)[] | { every: { open: string; close: string } };
  barFood?: boolean;
  cuisine?: string;
  score?: number;
};

const WINDOWS: Record<string, Window[]> = {
  everyNight: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 26 }],
  weekendLate: [
    { days: [4, 5, 6], from: 21, to: 27 },
    { days: [0, 1, 2, 3], from: 19, to: 25 },
  ],
  earlyEvening: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 17, to: 23 }],
  dinner: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 23 }],
  cocktailHours: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 19, to: 25 }],
  brooklynLate: [
    { days: [4, 5, 6], from: 21, to: 28 },
    { days: [0, 1, 2, 3], from: 19, to: 26 },
  ],
};

const GRADIENTS = [
  { from: "#16213a", to: "#2e4470", angle: 160 },
  { from: "#0f1b17", to: "#1f4a3c", angle: 200 },
  { from: "#2b1d0c", to: "#8a6320", angle: 170 },
  { from: "#2a0f1c", to: "#7a2444", angle: 150 },
  { from: "#0c2419", to: "#1f5a3f", angle: 165 },
  { from: "#161922", to: "#3a4150", angle: 180 },
  { from: "#3a1a2a", to: "#8a3f5a", angle: 155 },
  { from: "#0e2a3a", to: "#1f6a8a", angle: 175 },
  { from: "#1c160a", to: "#6b5a1e", angle: 160 },
  { from: "#1c1030", to: "#4a2a7a", angle: 165 },
];

function gradientFor(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const CAPACITIES = ["tiny", "small", "medium", "large"] as const;

function toSeed(r: Researched): SeedVenue {
  return {
    slug: r.slug,
    kind: r.kind === "restaurant" ? "restaurant" : "bar",
    name: r.name,
    neighborhood: (isNeighborhoodId(r.neighborhood) ? r.neighborhood : "west-village") as NeighborhoodId,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    take: r.take,
    theCatch: r.theCatch || undefined,
    tags: r.tags.slice(0, 4),
    vibe: r.vibe,
    attrs: r.attrs ?? {},
    groupFit: r.groupFit,
    dateFit: r.dateFit,
    price: Math.min(4, Math.max(1, Math.round(r.price))) as 1 | 2 | 3 | 4,
    capacity: (CAPACITIES as readonly string[]).includes(r.capacity) ? (r.capacity as (typeof CAPACITIES)[number]) : "medium",
    bestWindows: WINDOWS[r.bestWindows] ?? WINDOWS.everyNight,
    easyIn: r.easyIn,
    photo: gradientFor(r.slug),
    friendsBeen: 0,
    verified: false,
    sources: r.sources,
    notes: r.notes,
    hours: seedHours(r.hours),
    barFood: !!r.barFood,
    cuisine: r.cuisine?.trim() || undefined,
    score: typeof r.score === "number" ? Math.max(0, Math.min(100, Math.round(r.score))) : undefined,
  };
}

function seedHours(h: Researched["hours"]): Hours | undefined {
  if (!h) return undefined;
  if (!Array.isArray(h)) return everyDay(h.every.open, h.every.close);
  return cleanHours(h.map((d) => d ?? null));
}

const FILES = [westVillage, eastVillage, lowerEastSide, sohoNolita, tribeca, chelsea, williamsburg, greenpoint] as unknown as Researched[][];

export const RESEARCHED: SeedVenue[] = FILES.flat().map(toSeed);
