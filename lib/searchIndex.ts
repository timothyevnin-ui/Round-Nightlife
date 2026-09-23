import type { Venue } from "./types";

/** What the search page needs per place: small enough to ship all of them. */
export type SearchEntry = {
  slug: string;
  name: string;
  verified?: boolean;
  score?: number;
  neighborhood: Venue["neighborhood"];
  kind: Venue["kind"];
  tags: string[];
  price: number;
  hot?: boolean;
  photo: Venue["photo"];
  photoUrl?: string;
  lat: number;
  lng: number;
  /** The first clause of the Take, for the row. */
  line: string;
};

export function toSearchEntry(v: Venue): SearchEntry {
  const line = (v.take.split(/[;:.]/)[0] ?? v.take).trim().slice(0, 90);
  return {
    slug: v.slug,
    name: v.name,
    neighborhood: v.neighborhood,
    kind: v.kind,
    tags: v.tags.slice(0, 3),
    price: v.price,
    hot: v.hot || undefined,
    verified: v.verified || undefined,
    score: v.score,
    photo: v.photo,
    photoUrl: v.photoUrl,
    lat: v.lat,
    lng: v.lng,
    line,
  };
}
