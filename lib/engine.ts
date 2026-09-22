import { NEIGHBORHOOD_MAP } from "./neighborhoods";
import { ATTRS, type AttrKey } from "./attrs";
import type { Wants } from "./questions";
import type { DatePlan, DateQuery, GroupBucket, NightPick, NightQuery, PickLabel, Venue, Window } from "./types";

/**
 * Deterministic scoring. No AI, no black box: every number below is a knob.
 *
 *   score = neighborhood·W.nb + groupFit·W.group + timeWindow·W.time + prefs·W.prefs
 *           × capacityPenalty × linePenalty × beenPenalty
 *
 * `prefs` is how well the venue's attributes match what the person swiped.
 */
const W = { nb: 0.18, group: 0.22, time: 0.14, prefs: 0.46 };

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
  return windows.some((w) => w.days.includes(dow) && hour >= w.from && hour < w.to);
}

function timeScore(venue: Venue, hour: number, dow: number): number {
  if (inWindow(venue.bestWindows, hour, dow)) return 1;
  // After midnight: late-night attribute carries the venue.
  if (hour >= 24) return 0.35 + 0.5 * venue.attrs.late;
  return 0.55;
}

function capacityPenalty(venue: Venue, bucket: GroupBucket): number {
  const c = venue.capacity;
  if (bucket === "big") return c === "tiny" ? 0.25 : c === "small" ? 0.55 : c === "medium" ? 0.85 : 1;
  if (bucket === "mid") return c === "tiny" ? 0.5 : c === "small" ? 0.8 : 1;
  if (bucket === "small") return c === "tiny" ? 0.85 : 1;
  return 1;
}

/**
 * Preference match, 0..1. Each answered want contributes
 * want × (attr − 0.5) × 2, so a strong yes on a strong attribute is +1 and a
 * strong yes on an absent attribute is −1. Unanswered attributes don't count.
 */
export function prefsScore(venue: Venue, wants: Wants): { score: number; hits: AttrKey[] } {
  let sum = 0;
  let weight = 0;
  const hits: AttrKey[] = [];
  for (const [k, w] of Object.entries(wants) as [keyof Wants, number][]) {
    if (!w || k === "noLine" || k === "new") continue;
    const attr = venue.attrs[k as AttrKey];
    if (typeof attr !== "number") continue;
    const match = (attr - 0.5) * 2; // −1..1
    sum += w * match;
    weight += Math.abs(w);
    if (w > 0 && attr >= 0.7) hits.push(k as AttrKey);
  }
  if (weight === 0) return { score: 0.5, hits };
  return { score: (sum / weight + 1) / 2, hits };
}

function linePenalty(venue: Venue, wants: Wants): number {
  const w = wants.noLine ?? 0;
  if (w <= 0) return 1;
  // Wanting no line: scale by how easy it is to get in.
  return 1 - w * 0.6 * (1 - venue.easyIn);
}

function beenPenalty(venue: Venue, wants: Wants, been?: string[]): number {
  const w = wants.new ?? 0;
  if (w <= 0 || !been?.length) return 1;
  return been.includes(venue.slug) ? 1 - 0.7 * w : 1;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function groupWord(n: number) {
  if (n <= 2) return "two";
  if (n >= 11) return "a big group";
  return `${n}`;
}

const HIT_WORD: Partial<Record<AttrKey, string>> = {
  dance: "Dancing",
  seating: "You'll sit",
  lively: "Loud",
  talk: "You can talk",
  chill: "Chill",
  sports: "Game's on",
  liveMusic: "Live music",
  cocktails: "Real cocktails",
  beer: "Good pints",
  wine: "Wine",
  outdoor: "Outside",
  rooftop: "Views",
  speakeasy: "Hidden",
  classic: "Old New York",
  dive: "Proper dive",
  upscale: "Nice",
  cheap: "Cheap",
  dressy: "Dress up",
  late: "Late",
  food: "Food",
  social: "Meet people",
  groups: "Groups welcome",
  activity: "Something to do",
  frozen: "Frozen drinks",
  scene: "Sceney",
  happyHour: "Happy hour",
  date: "Date-y",
  lgbtq: "Queer night",
};

/* ───────────────────────── NIGHT OUT ───────────────────────── */

export function recommendNight(q: NightQuery, venues: Venue[]): NightPick[] {
  const bucket = groupBucket(q.group);
  const scored = venues
    .filter((v) => v.kind === "bar")
    .map((venue) => {
      const nb = neighborhoodScore(venue, q.neighborhood);
      if (nb === null) return null;
      const group = venue.groupFit[bucket];
      const time = timeScore(venue, q.hour, q.dow);
      const { score: prefs, hits } = prefsScore(venue, q.wants);
      const base = nb * W.nb + group * W.group + time * W.time + prefs * W.prefs;
      const score = base * capacityPenalty(venue, bucket) * linePenalty(venue, q.wants) * beenPenalty(venue, q.wants, q.been);
      return { venue, score, hits, group };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const picks: NightPick[] = [];
  const used = new Set<string>();
  const why = (s: (typeof scored)[number], label: PickLabel) => {
    const parts = s.hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];
    if (s.group >= 0.8 && parts.length < 3) parts.push(`Good for ${groupWord(q.group)}`);
    if (label === "Easy in") parts.push("Room to walk in");
    if (s.venue.neighborhood !== q.neighborhood) parts.push(`Next door in ${NEIGHBORHOOD_MAP[s.venue.neighborhood].short}`);
    return parts.slice(0, 3).join(" · ");
  };

  const first = scored[0];
  picks.push({ venue: first.venue, label: "The pick", score: first.score, why: why(first, "The pick") });
  used.add(first.venue.slug);

  const dominant = (v: Venue) => (["lively", "chill", "talk"] as AttrKey[]).sort((a, b) => v.attrs[b] - v.attrs[a])[0];
  const second =
    scored.find((s) => !used.has(s.venue.slug) && (s.venue.capacity !== first.venue.capacity || dominant(s.venue) !== dominant(first.venue))) ??
    scored.find((s) => !used.has(s.venue.slug));
  if (second) {
    picks.push({ venue: second.venue, label: "Also great", score: second.score, why: why(second, "Also great") });
    used.add(second.venue.slug);
  }

  const easy =
    scored
      .filter((s) => !used.has(s.venue.slug))
      .map((s) => ({ ...s, easyScore: s.score * (0.5 + 0.5 * s.venue.easyIn) }))
      .filter((s) => s.venue.easyIn >= 0.55 && (bucket === "two" || s.venue.capacity !== "tiny"))
      .sort((a, b) => b.easyScore - a.easyScore)[0] ?? scored.find((s) => !used.has(s.venue.slug));
  if (easy) picks.push({ venue: easy.venue, label: "Easy in", score: easy.score, why: why(easy, "Easy in") });

  return picks;
}

/* ───────────────────────── DATE ───────────────────────── */

const STAGE_WORD = { first: "First date", early: "A few dates in", longterm: "Long-term" } as const;

function scoreDateVenue(venue: Venue, q: DateQuery, weights: { fit: number; prefs: number; nb: number; time: number }) {
  const nb = neighborhoodScore(venue, q.neighborhood);
  if (nb === null) return null;
  const fit = venue.dateFit[q.stage];
  // A date always leans on the venue's date-ness a little, even with no swipes.
  const wants: Wants = { date: 0.4, ...q.wants };
  const { score: prefs, hits } = prefsScore(venue, wants);
  const time = timeScore(venue, q.hour, q.dow);
  const score = (fit * weights.fit + prefs * weights.prefs + nb * weights.nb + time * weights.time) * linePenalty(venue, q.wants) * beenPenalty(venue, q.wants, q.been);
  return { score, hits };
}

export function recommendDate(q: DateQuery, venues: Venue[]): DatePlan[] {
  const bars = venues
    .filter((v) => v.kind === "bar")
    .map((venue) => ({ venue, r: scoreDateVenue(venue, q, { fit: 0.38, prefs: 0.4, nb: 0.12, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; r: { score: number; hits: AttrKey[] } } => x.r !== null)
    .map((x) => ({ venue: x.venue, score: x.r.score, hits: x.r.hits }))
    .sort((a, b) => b.score - a.score);

  const hitWords = (hits: AttrKey[]) => hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];

  if (!q.dinner) {
    const labels: PickLabel[] = ["The pick", "Also great", "Easy in"];
    const chosen: typeof bars = [];
    for (const b of bars) {
      if (chosen.length === 3) break;
      if (chosen.length === 2) {
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
      why: [STAGE_WORD[q.stage], ...hitWords(c.hits), labels[i] === "Easy in" ? "Room to walk in" : null].filter(Boolean).slice(0, 3).join(" · "),
    }));
  }

  const restaurants = venues
    .filter((v) => v.kind === "restaurant")
    .map((venue) => ({ venue, r: scoreDateVenue(venue, q, { fit: 0.45, prefs: 0.3, nb: 0.15, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; r: { score: number; hits: AttrKey[] } } => x.r !== null)
    .map((x) => ({ venue: x.venue, score: x.r.score, hits: x.r.hits }))
    .sort((a, b) => b.score - a.score);

  const plans: DatePlan[] = [];
  const usedBars = new Set<string>();
  const labels: PickLabel[] = ["The pick", "Also great", "Easy in"];

  const pick: typeof restaurants = restaurants.slice(0, 2);
  const easyRestaurant = restaurants.find((r) => r.venue.easyIn >= 0.45 && !pick.includes(r));
  if (easyRestaurant) pick.push(easyRestaurant);
  else {
    const next = restaurants.find((r) => !pick.includes(r));
    if (next) pick.push(next);
  }

  pick.forEach((r, i) => {
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
    const drinksAt = Math.round((dinnerAt + 1.75) * 4) / 4;
    plans.push({
      restaurant: r.venue,
      bar: bar.venue,
      label: labels[i],
      score: r.score,
      dinnerAt,
      drinksAt,
      walkMinutes: walk,
      why: [STAGE_WORD[q.stage], ...hitWords([...r.hits, ...bar.hits]), `${walk} min walk between`].slice(0, 3).join(" · "),
    });
  });

  return plans;
}

/** Labels for the attribute chips on venue pages, derived from strong attrs. */
export function strongAttrLabels(venue: Venue, max = 4): string[] {
  return (Object.entries(venue.attrs) as [AttrKey, number][])
    .filter(([, v]) => v >= 0.8)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => ATTRS[k].label)
    .slice(0, max);
}
