import { NEIGHBORHOOD_MAP } from "./neighborhoods";
import { VENUES } from "./venues";
import type {
  DatePlan,
  DateQuery,
  DateVibe,
  GroupBucket,
  NightPick,
  NightQuery,
  PickLabel,
  Venue,
  Window,
} from "./types";

/* ───────────────────────── helpers ───────────────────────── */

export function groupBucket(n: number): GroupBucket {
  if (n <= 2) return "two";
  if (n <= 4) return "small";
  if (n <= 7) return "mid";
  return "big";
}

function neighborhoodScore(venue: Venue, target: NightQuery["neighborhood"]): number | null {
  if (venue.neighborhood === target) return 1;
  if (NEIGHBORHOOD_MAP[target].adjacent.includes(venue.neighborhood)) return 0.55;
  return null;
}

function inWindow(windows: readonly Window[], hour: number, dow: number): boolean {
  // hour may be 24+ (after midnight, still "tonight"). Windows use the same convention.
  return windows.some((w) => w.days.includes(dow) && hour >= w.from && hour < w.to);
}

function timeScore(venue: Venue, hour: number, dow: number): number {
  return inWindow(venue.bestWindows, hour, dow) ? 1 : 0.55;
}

function capacityPenalty(venue: Venue, bucket: GroupBucket): number {
  const c = venue.capacity;
  if (bucket === "big") return c === "tiny" ? 0.25 : c === "small" ? 0.55 : c === "medium" ? 0.85 : 1;
  if (bucket === "mid") return c === "tiny" ? 0.5 : c === "small" ? 0.8 : 1;
  if (bucket === "small") return c === "tiny" ? 0.85 : 1;
  return 1;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const VIBE_WORD: Record<NightQuery["vibe"], string> = {
  lively: "Lively",
  chill: "Chill",
  talk: "Can actually talk",
};

function groupWord(n: number) {
  if (n <= 2) return "two";
  if (n >= 11) return "a big group";
  return `${n}`;
}

/* ───────────────────────── NIGHT OUT ───────────────────────── */

export function recommendNight(q: NightQuery): NightPick[] {
  const bucket = groupBucket(q.group);
  const scored = VENUES.filter((v) => v.kind === "bar")
    .map((venue) => {
      const nb = neighborhoodScore(venue, q.neighborhood);
      if (nb === null) return null;
      const vibe = venue.vibe[q.vibe];
      const group = venue.groupFit[bucket];
      const time = timeScore(venue, q.hour, q.dow);
      const base = nb * 0.2 + vibe * 0.38 + group * 0.24 + time * 0.18;
      const score = base * capacityPenalty(venue, bucket);
      return { venue, score, nb, vibe, group, time };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const picks: NightPick[] = [];
  const used = new Set<string>();

  const first = scored[0];
  picks.push(makeNightPick(first.venue, "The pick", first.score, q));
  used.add(first.venue.slug);

  // Also great: next best that isn't a near-duplicate of the pick (different capacity or dominant vibe).
  const dominant = (v: Venue) =>
    (Object.entries(v.vibe) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const second =
    scored.find(
      (s) =>
        !used.has(s.venue.slug) &&
        (s.venue.capacity !== first.venue.capacity || dominant(s.venue) !== dominant(first.venue)),
    ) ?? scored.find((s) => !used.has(s.venue.slug));
  if (second) {
    picks.push(makeNightPick(second.venue, "Also great", second.score, q));
    used.add(second.venue.slug);
  }

  // Easy in: the best remaining place you can actually walk into with this group.
  const easy = scored
    .filter((s) => !used.has(s.venue.slug))
    .map((s) => ({ ...s, easyScore: s.score * (0.5 + 0.5 * s.venue.easyIn) }))
    .filter((s) => s.venue.easyIn >= 0.55 && (bucket === "two" || s.venue.capacity !== "tiny"))
    .sort((a, b) => b.easyScore - a.easyScore)[0] ?? scored.find((s) => !used.has(s.venue.slug));
  if (easy) {
    picks.push(makeNightPick(easy.venue, "Easy in", easy.score, q));
  }

  return picks;
}

function makeNightPick(venue: Venue, label: PickLabel, score: number, q: NightQuery): NightPick {
  const parts: string[] = [];
  if (venue.vibe[q.vibe] >= 0.7) parts.push(VIBE_WORD[q.vibe]);
  const b = groupBucket(q.group);
  if (venue.groupFit[b] >= 0.8) parts.push(`Good for ${groupWord(q.group)}`);
  if (label === "Easy in") parts.push("Room to walk in");
  if (venue.neighborhood !== q.neighborhood) parts.push(`Next door in ${NEIGHBORHOOD_MAP[venue.neighborhood].short}`);
  return { venue, label, score, why: parts.slice(0, 3).join(" · ") };
}

/* ───────────────────────── DATE ───────────────────────── */

function dateVibeScore(venue: Venue, vibe: DateVibe): number {
  if (vibe === "talk") return venue.vibe.talk;
  if (vibe === "lively") return venue.vibe.lively;
  // low-lit & cocktails: chill room, cocktail-forward tags help
  const cocktail = venue.tags.some((t) => /cocktail|wine|martini|speakeasy/i.test(t)) ? 1 : 0.6;
  return venue.vibe.chill * 0.6 + cocktail * 0.4;
}

function scoreDateVenue(venue: Venue, q: DateQuery, weights: { fit: number; vibe: number; nb: number; time: number }) {
  const nb = neighborhoodScore(venue, q.neighborhood);
  if (nb === null) return null;
  const fit = venue.dateFit[q.stage];
  const vibe = dateVibeScore(venue, q.vibe);
  const time = timeScore(venue, q.hour, q.dow);
  return fit * weights.fit + vibe * weights.vibe + nb * weights.nb + time * weights.time;
}

const STAGE_WORD = { first: "First date", early: "A few dates in", longterm: "Long-term" } as const;
const DATE_VIBE_WORD = { talk: "Can actually talk", lowlit: "Low-lit & cocktails", lively: "A little lively" } as const;

export function recommendDate(q: DateQuery): DatePlan[] {
  const bars = VENUES.filter((v) => v.kind === "bar")
    .map((venue) => ({ venue, score: scoreDateVenue(venue, q, { fit: 0.4, vibe: 0.35, nb: 0.15, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);

  if (!q.dinner) {
    const labels: PickLabel[] = ["The pick", "Also great", "Easy in"];
    const chosen: typeof bars = [];
    for (const b of bars) {
      if (chosen.length === 3) break;
      if (chosen.length === 2) {
        // Easy in: prefer something you can walk into.
        const easy = bars.find((x) => !chosen.includes(x) && x.venue.easyIn >= 0.5);
        chosen.push(easy ?? b);
        break;
      }
      chosen.push(b);
    }
    return chosen.map((c, i) => ({
      bar: c.venue,
      label: labels[i],
      score: c.score,
      drinksAt: q.hour,
      why: [STAGE_WORD[q.stage], DATE_VIBE_WORD[q.vibe], labels[i] === "Easy in" ? "Room to walk in" : null]
        .filter(Boolean)
        .join(" · "),
    }));
  }

  const restaurants = VENUES.filter((v) => v.kind === "restaurant")
    .map((venue) => ({ venue, score: scoreDateVenue(venue, q, { fit: 0.45, vibe: 0.25, nb: 0.2, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);

  const plans: DatePlan[] = [];
  const usedBars = new Set<string>();
  const labels: PickLabel[] = ["The pick", "Also great", "Easy in"];

  const ordered = [...restaurants];
  // Third plan favors a restaurant you can actually get into.
  const easyRestaurant = restaurants.find((r) => r.venue.easyIn >= 0.45);

  const pickRestaurants: typeof restaurants = [];
  for (const r of ordered) {
    if (pickRestaurants.length >= 2) break;
    pickRestaurants.push(r);
  }
  if (easyRestaurant && !pickRestaurants.includes(easyRestaurant)) pickRestaurants.push(easyRestaurant);
  else {
    const next = ordered.find((r) => !pickRestaurants.includes(r));
    if (next) pickRestaurants.push(next);
  }

  pickRestaurants.forEach((r, i) => {
    // Best bar within a short walk, not already used.
    const candidates = bars
      .filter((b) => !usedBars.has(b.venue.slug))
      .map((b) => ({ ...b, dist: haversineMeters(r.venue, b.venue) }))
      .filter((b) => b.dist <= 900)
      .map((b) => ({ ...b, combined: b.score * (1 - Math.min(b.dist, 900) / 3000) }))
      .sort((a, b) => b.combined - a.combined);
    const bar = candidates[0] ?? bars.find((b) => !usedBars.has(b.venue.slug)) ?? bars[0];
    if (!bar) return;
    usedBars.add(bar.venue.slug);
    const dist = haversineMeters(r.venue, bar.venue);
    const walk = Math.max(2, Math.round(dist / 80));
    const dinnerAt = q.hour;
    const drinksAt = roundQuarter(dinnerAt + 1.75);
    plans.push({
      restaurant: r.venue,
      bar: bar.venue,
      label: labels[i],
      score: r.score,
      dinnerAt,
      drinksAt,
      walkMinutes: walk,
      why: [STAGE_WORD[q.stage], DATE_VIBE_WORD[q.vibe], `${walk} min walk between`].join(" · "),
    });
  });

  return plans;
}

function roundQuarter(h: number) {
  return Math.round(h * 4) / 4;
}
