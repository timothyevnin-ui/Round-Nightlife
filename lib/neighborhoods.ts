import type { NeighborhoodId } from "./types";

export type Neighborhood = {
  id: NeighborhoodId;
  name: string;
  short: string;
  borough: "Manhattan" | "Brooklyn";
  center: { lat: number; lng: number };
  adjacent: NeighborhoodId[];
};

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: "west-village",
    name: "West Village",
    short: "West Village",
    borough: "Manhattan",
    center: { lat: 40.7336, lng: -74.0027 },
    adjacent: ["soho-nolita", "chelsea", "tribeca", "east-village"],
  },
  {
    id: "east-village",
    name: "East Village",
    short: "East Village",
    borough: "Manhattan",
    center: { lat: 40.7265, lng: -73.9853 },
    adjacent: ["lower-east-side", "soho-nolita", "west-village"],
  },
  {
    id: "lower-east-side",
    name: "Lower East Side",
    short: "LES",
    borough: "Manhattan",
    center: { lat: 40.7185, lng: -73.9895 },
    adjacent: ["east-village", "soho-nolita"],
  },
  {
    id: "soho-nolita",
    name: "SoHo & Nolita",
    short: "SoHo",
    borough: "Manhattan",
    center: { lat: 40.7233, lng: -73.9975 },
    adjacent: ["west-village", "east-village", "lower-east-side", "tribeca"],
  },
  {
    id: "tribeca",
    name: "Tribeca",
    short: "Tribeca",
    borough: "Manhattan",
    center: { lat: 40.7185, lng: -74.0083 },
    adjacent: ["soho-nolita", "west-village"],
  },
  {
    id: "chelsea",
    name: "Chelsea",
    short: "Chelsea",
    borough: "Manhattan",
    center: { lat: 40.7455, lng: -74.0033 },
    adjacent: ["west-village", "murray-hill"],
  },
  {
    id: "murray-hill",
    name: "Murray Hill & Kips Bay",
    short: "Murray Hill",
    borough: "Manhattan",
    center: { lat: 40.745, lng: -73.9785 },
    adjacent: ["chelsea", "east-village"],
  },
  {
    id: "williamsburg",
    name: "Williamsburg",
    short: "Williamsburg",
    borough: "Brooklyn",
    center: { lat: 40.7158, lng: -73.9581 },
    adjacent: ["greenpoint"],
  },
  {
    id: "greenpoint",
    name: "Greenpoint",
    short: "Greenpoint",
    borough: "Brooklyn",
    center: { lat: 40.7295, lng: -73.9558 },
    adjacent: ["williamsburg"],
  },
];

export const NEIGHBORHOOD_MAP: Record<NeighborhoodId, Neighborhood> = Object.fromEntries(
  NEIGHBORHOODS.map((n) => [n.id, n]),
) as Record<NeighborhoodId, Neighborhood>;

export function neighborhoodName(id: NeighborhoodId) {
  return NEIGHBORHOOD_MAP[id]?.name ?? id;
}

export function isNeighborhoodId(x: string | undefined | null): x is NeighborhoodId {
  return !!x && x in NEIGHBORHOOD_MAP;
}
