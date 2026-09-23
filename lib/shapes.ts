import type { NeighborhoodId } from "./types";
import { NEIGHBORHOOD_MAP, NEIGHBORHOODS } from "./neighborhoods";

export type LngLat = [number, number];

/** Hand-traced along the streets people actually use as the borders. Roughly ±100 m. */
export const SHAPES: Record<NeighborhoodId, LngLat[]> = {
  "west-village": [
    [-74.0046, 40.7407], // 14th & 9th Ave
    [-73.9967, 40.7378], // 14th & 6th Ave
    [-73.991, 40.7356], // Union Sq West
    [-73.996, 40.7254], // Broadway & Houston
    [-74.003, 40.7279], // 6th Ave & Houston
    [-74.0116, 40.7291], // Houston & the river
    [-74.0108, 40.7345],
    [-74.0098, 40.7395], // Gansevoort & the river
    [-74.0058, 40.7385], // Gansevoort & 9th Ave
  ],
  "east-village": [
    [-73.99, 40.7345], // 14th & 4th Ave
    [-73.9735, 40.7284], // 14th & the river
    [-73.9765, 40.7195], // Houston & the river
    [-73.9926, 40.7245], // Houston & Bowery
    [-73.9917, 40.73], // Astor Place
  ],
  "lower-east-side": [
    [-73.9926, 40.7245], // Houston & Bowery
    [-73.9765, 40.7195], // Houston & the river
    [-73.9845, 40.7125],
    [-73.9895, 40.7085], // under the Manhattan Bridge
    [-73.9965, 40.7152], // Canal & Bowery
  ],
  "soho-nolita": [
    [-74.003, 40.7279], // 6th Ave & Houston
    [-73.996, 40.7254], // Broadway & Houston
    [-73.9926, 40.7245], // Bowery & Houston
    [-73.9965, 40.7152], // Canal & Bowery
    [-74.0004, 40.719], // Canal & Broadway
    [-74.0052, 40.7226], // Canal & 6th Ave
  ],
  tribeca: [
    [-74.0112, 40.7248], // Canal & the river
    [-74.0052, 40.7226], // Canal & 6th Ave
    [-74.0004, 40.719], // Canal & Broadway
    [-74.0067, 40.7143], // Chambers & Broadway
    [-74.013, 40.7167], // Chambers & the river
  ],
  chelsea: [
    [-74.0098, 40.7395], // Gansevoort & the river
    [-74.0058, 40.7385], // Gansevoort & 9th Ave
    [-74.0046, 40.7407], // 14th & 9th Ave
    [-73.9967, 40.7378], // 14th & 6th Ave
    [-73.9895, 40.7477], // 30th & 6th Ave
    [-74.0058, 40.7545], // 30th & the river
    [-74.0085, 40.747],
  ],
  williamsburg: [
    [-73.9615, 40.7255], // Bushwick Inlet
    [-73.9545, 40.7212], // McCarren Park, Bedford & N 12th
    [-73.947, 40.719], // Meeker & the BQE
    [-73.9425, 40.712], // BQE & Metropolitan
    [-73.9475, 40.703], // Broadway & Flushing
    [-73.9625, 40.7095], // Williamsburg Bridge
    [-73.9675, 40.7145], // Domino Park
    [-73.9645, 40.72],
  ],
  greenpoint: [
    [-73.9615, 40.7255], // Bushwick Inlet
    [-73.9545, 40.7212], // McCarren Park corner
    [-73.9495, 40.7245], // Nassau & Manhattan Ave
    [-73.9425, 40.7265], // Nassau & the BQE
    [-73.939, 40.733], // Newtown Creek, Kingsland
    [-73.9485, 40.7378], // Newtown Creek
    [-73.9605, 40.7372], // the north tip
    [-73.9615, 40.7305], // Transmitter Park
  ],
};

/** Ray casting: is the point inside the polygon? */
function inside(pt: LngLat, poly: LngLat[]): boolean {
  const [x, y] = pt;
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Which neighborhood a point is in. Inside a traced shape wins; otherwise the
 * nearest center, if it's within about a mile (so a Hoboken address doesn't
 * become "West Village"). Null when it's nowhere ROUND covers.
 */
export function neighborhoodAt(lat: number, lng: number): NeighborhoodId | null {
  for (const n of NEIGHBORHOODS) if (inside([lng, lat], SHAPES[n.id])) return n.id;
  let best: { id: NeighborhoodId; d: number } | null = null;
  for (const n of NEIGHBORHOODS) {
    const c = NEIGHBORHOOD_MAP[n.id].center;
    const d = Math.hypot((lat - c.lat) * 111, (lng - c.lng) * 84); // km
    if (!best || d < best.d) best = { id: n.id, d };
  }
  return best && best.d <= 1.6 ? best.id : null;
}
