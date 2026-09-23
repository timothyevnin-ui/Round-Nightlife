import { ATTR_KEYS, deriveDaytime, type AttrKey } from "./attrs";
import type { Attrs, Venue, Window } from "./types";

/**
 * A seed entry is authored with the old shorthand (vibe + tags) and optional
 * attribute overrides; the database stores full attrs. Both normalize into the
 * same Venue shape, with every attribute present as a 0–1 number.
 */
export type SeedVenue = Omit<Venue, "attrs"> & {
  vibe?: { lively: number; chill: number; talk: number };
  attrs?: Partial<Attrs>;
};

const has = (tags: string[], ...names: string[]) => {
  const lower = tags.map((t) => t.toLowerCase());
  return names.some((n) => lower.some((t) => t.includes(n.toLowerCase())));
};

const latestClose = (w: Window[]) => Math.max(0, ...w.map((x) => x.to));

export function emptyAttrs(): Attrs {
  return Object.fromEntries(ATTR_KEYS.map((k) => [k, 0])) as Attrs;
}

export function clamp01(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

/** Derive a full attribute set from the shorthand, then apply overrides. */
export function deriveAttrs(v: SeedVenue): Attrs {
  const t = v.tags ?? [];
  const vibe = v.vibe ?? { lively: 0.5, chill: 0.5, talk: 0.5 };
  const cap = v.capacity;
  const price = v.price;
  const dateMax = Math.max(v.dateFit.first, v.dateFit.early, v.dateFit.longterm);
  const close = latestClose(v.bestWindows);
  const isRestaurant = v.kind === "restaurant";

  const a: Attrs = emptyAttrs();
  a.lively = vibe.lively;
  a.talk = vibe.talk;
  a.chill = vibe.chill;
  a.dance = has(t, "dancing", "dj") ? 1 : vibe.lively >= 0.9 && has(t, "late", "dive") ? 0.4 : 0.1;
  a.liveMusic = has(t, "live music", "jazz", "honky") ? 1 : 0;
  a.sports = has(t, "sports") ? 1 : has(t, "pub") ? 0.4 : has(t, "tavern") ? 0.3 : 0.1;
  a.seating = isRestaurant ? 0.9 : ({ tiny: 0.2, small: 0.35, medium: 0.5, large: 0.8 }[cap] ?? 0.5) + (has(t, "pub", "tavern", "beer hall", "roomy") ? 0.15 : 0);
  a.outdoor = has(t, "backyard", "garden") ? 1 : has(t, "rooftop") ? 0.8 : has(t, "corner", "aperitivo") ? 0.4 : 0.1;
  a.rooftop = has(t, "rooftop", "views") ? 1 : 0;
  a.speakeasy = has(t, "speakeasy", "hidden", "below street") ? 1 : has(t, "no menu") ? 0.6 : 0;
  a.classic = has(t, "old nyc", "classic", "brasserie", "tavern") ? 0.9 : has(t, "pub") ? 0.5 : 0.1;
  a.dive = has(t, "dive") ? 1 : price === 1 && vibe.lively >= 0.8 ? 0.5 : 0;
  a.upscale = price === 4 ? 1 : has(t, "upscale", "occasion", "views") ? 0.8 : price === 3 ? 0.6 : price === 2 ? 0.3 : 0;
  a.scene = has(t, "cool", "sceney") ? 0.6 : 0.2;
  a.cocktails = has(t, "cocktails", "martinis", "speakeasy", "no menu", "aperitivo") ? 1 : has(t, "wine") ? 0.3 : isRestaurant ? 0.4 : 0.3;
  a.beer = has(t, "beer", "pub", "beer hall", "dive", "tavern") ? 0.9 : 0.3;
  a.wine = has(t, "wine") ? 1 : has(t, "aperitivo") ? 0.6 : isRestaurant ? 0.5 : 0.2;
  a.frozen = has(t, "frozen") ? 1 : 0;
  a.food = isRestaurant ? 1 : has(t, "burgers", "fried chicken", "oysters", "pub", "tavern", "food") ? 0.7 : 0.2;
  a.cheap = price === 1 ? 1 : price === 2 ? 0.5 : price === 3 ? 0.15 : 0;
  a.dressy = has(t, "occasion", "views") ? 0.8 : has(t, "dive") ? 0 : price >= 3 && has(t, "date", "cocktails") ? 0.6 : 0.2;
  a.late = has(t, "late") ? 1 : close >= 27 ? 1 : close >= 26 ? 0.7 : 0.3;
  a.happyHour = has(t, "happy hour") ? 1 : has(t, "pub", "dive") || v.bestWindows.some((w) => w.from <= 17) ? 0.6 : 0.3;
  a.social = vibe.lively >= 0.8 && cap !== "tiny" ? 0.7 : 0.3;
  a.date = dateMax >= 0.85 ? 1 : dateMax >= 0.7 ? 0.6 : 0.2;
  a.groups = v.groupFit.big >= 0.8 ? 1 : v.groupFit.mid >= 0.85 ? 0.7 : v.groupFit.mid * 0.5;
  a.activity = has(t, "karaoke", "pool", "games", "darts") ? 1 : has(t, "live music") ? 0.4 : 0;
  a.lgbtq = has(t, "queer", "lgbtq", "gay") ? 1 : 0.2;
  a.daytime = has(t, "day", "daytime", "brunch", "beer garden", "beer hall", "backyard", "rooftop", "patio") ? 0.9 : deriveDaytime(a);

  for (const [k, val] of Object.entries(v.attrs ?? {}) as [AttrKey, number][]) a[k] = clamp01(val, a[k]);
  return a;
}

export function normalizeSeed(v: SeedVenue): Venue {
  const { vibe: _vibe, attrs: _attrs, ...rest } = v;
  void _vibe;
  void _attrs;
  return { ...rest, attrs: deriveAttrs(v) };
}
