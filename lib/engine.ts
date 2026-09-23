import { NEIGHBORHOOD_MAP } from "./neighborhoods";
import { ATTRS, type AttrKey } from "./attrs";
import type { Wants } from "./questions";
import type { DatePlan, DateQuery, DinnerQuery, GroupBucket, NightPick, NightQuery, PickLabel, Venue, Window } from "./types";

/**
 * Deterministic scoring. No AI, no black box: every number below is a knob.
 *
 *   score = neighborhood·W.nb + groupFit·W.group + timeWindow·W.time + prefs·W.prefs
 *           × capacityPenalty × linePenalty × beenPenalty
 *
 * `prefs` is how well the venue's attributes match what the person swiped.
 */
// With 20+ places per neighborhood, the one you tapped should win; next door
// is a fill-in, not a competitor.
const W = { nb: 0.24, group: 0.2, time: 0.14, prefs: 0.42 };
const W_DAY = { nb: 0.22, group: 0.16, time: 0.3, prefs: 0.32 };

/* ───────────────────────── helpers ───────────────────────── */

export function groupBucket(n: number): GroupBucket {
  if (n <= 2) return "two";
  if (n <= 4) return "small";
  if (n <= 7) return "mid";
  return "big";
}

function neighborhoodScore(venue: Venue, target: NightQuery["neighborhood"]): number | null {
  if (venue.neighborhood === target) return 1;
  if (NEIGHBORHOOD_MAP[target].adjacent.includes(venue.neighborhood)) return 0.35;
  return null;
}

function inWindow(windows: readonly Window[], hour: number, dow: number): boolean {
  return windows.some((w) => w.days.includes(dow) && hour >= w.from && hour < w.to);
}

/** Before 5pm it's a day out: the room's daylight-worthiness carries it, not its best window. */
export const DAY_ENDS = 17;
export const isDaytime = (hour: number) => hour >= 5 && hour < DAY_ENDS;

function timeScore(venue: Venue, hour: number, dow: number): number {
  if (isDaytime(hour)) return 0.15 + 0.85 * venue.attrs.daytime;
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

/**
 * A verified place (someone from ROUND has been, and the entry is right) wins
 * a tie and edges a near-tie. Big enough to break ties, small enough that a
 * verified place can't beat a clearly better fit.
 */
export const VERIFIED_BOOST = 1.08;
export function verifiedBoost(venue: Venue): number {
  return (venue.verified ? VERIFIED_BOOST : 1) * scoreBoost(venue);
}

/** ROUND's score nudges the order: 95 is about +5%, 55 about −5%, unscored is neutral. */
export function scoreBoost(venue: Venue): number {
  if (typeof venue.score !== "number") return 1;
  return 1 + Math.max(-0.06, Math.min(0.06, (venue.score - 75) / 400));
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
  upscale: "Bougie",
  cheap: "Cheap",
  dressy: "Bougie crowd",
  late: "Late",
  food: "Food",
  social: "Meet people",
  groups: "Groups welcome",
  activity: "Something to do",
  frozen: "Frozen drinks",
  scene: "Sceney",
  happyHour: "Happy hour",
  date: "Date-y",
  daytime: "Good in the day",
};

/* ───────────────────────── NIGHT OUT ───────────────────────── */

/** How many cards a results carousel shows. */
export const RESULT_COUNT = 6;

type Scored = { venue: Venue; score: number; hits: AttrKey[]; group: number };

/** A label for slots four through six: what makes this one different. */
function flavorLabel(venue: Venue, taken: Set<PickLabel>): PickLabel {
  const a = venue.attrs;
  const candidates: [boolean, PickLabel][] = [
    [a.late >= 0.85, "Late one"],
    [a.cheap >= 0.85, "Cheap and good"],
    [a.upscale >= 0.85, "Splurge"],
    [venue.capacity === "large", "Big room"],
    [a.classic >= 0.85, "Classic"],
  ];
  for (const [ok, label] of candidates) if (ok && !taken.has(label)) return label;
  return taken.has("Sleeper") ? "Wildcard" : "Sleeper";
}

const dominant = (v: Venue) => (["lively", "chill", "talk"] as AttrKey[]).sort((a, b) => v.attrs[b] - v.attrs[a])[0];

/**
 * Turn a ranked list into a carousel: the best, a genuinely different second,
 * something you can walk into, then the next best with a reason each.
 */
function diversify(scored: Scored[], bucket: GroupBucket, count: number): { s: Scored; label: PickLabel }[] {
  if (scored.length === 0) return [];
  const out: { s: Scored; label: PickLabel }[] = [];
  const used = new Set<string>();
  const take = (s: Scored | undefined, label: PickLabel) => {
    if (!s || used.has(s.venue.slug)) return;
    used.add(s.venue.slug);
    out.push({ s, label });
  };

  const first = scored[0];
  take(first, "The pick");

  take(
    scored.find((s) => !used.has(s.venue.slug) && (s.venue.capacity !== first.venue.capacity || dominant(s.venue) !== dominant(first.venue))) ??
      scored.find((s) => !used.has(s.venue.slug)),
    "Also great",
  );

  take(
    scored
      .filter((s) => !used.has(s.venue.slug))
      .map((s) => ({ ...s, easyScore: s.score * (0.5 + 0.5 * s.venue.easyIn) }))
      .filter((s) => s.venue.easyIn >= 0.55 && (bucket === "two" || s.venue.capacity !== "tiny"))
      .sort((a, b) => b.easyScore - a.easyScore)[0] ?? scored.find((s) => !used.has(s.venue.slug)),
    "Easy in",
  );

  const taken = new Set<PickLabel>();
  for (const s of scored) {
    if (out.length >= count) break;
    if (used.has(s.venue.slug)) continue;
    const label = flavorLabel(s.venue, taken);
    taken.add(label);
    take(s, label);
  }
  return out.slice(0, count);
}

export function recommendNight(q: NightQuery, venues: Venue[], count = RESULT_COUNT): NightPick[] {
  const bucket = groupBucket(q.group);
  const scored: Scored[] = venues
    .filter((v) => v.kind === "bar")
    .map((venue) => {
      const nb = neighborhoodScore(venue, q.neighborhood);
      if (nb === null) return null;
      const group = venue.groupFit[bucket];
      const time = timeScore(venue, q.hour, q.dow);
      const { score: prefs, hits } = prefsScore(venue, q.wants);
      const w = isDaytime(q.hour) ? W_DAY : W;
      const base = nb * w.nb + group * w.group + time * w.time + prefs * w.prefs;
      const score = base * capacityPenalty(venue, bucket) * linePenalty(venue, q.wants) * beenPenalty(venue, q.wants, q.been) * verifiedBoost(venue);
      return { venue, score, hits, group };
    })
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score);

  const why = (s: Scored, label: PickLabel) => {
    const parts = s.hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];
    if (s.group >= 0.8 && parts.length < 3) parts.push(`Good for ${groupWord(q.group)}`);
    if (label === "Easy in") parts.push("Room to walk in");
    if (s.venue.neighborhood !== q.neighborhood) parts.push(`Next door in ${NEIGHBORHOOD_MAP[s.venue.neighborhood].short}`);
    return parts.slice(0, 3).join(" · ");
  };

  return diversify(scored, bucket, count).map(({ s, label }) => ({ venue: s.venue, label, score: s.score, why: why(s, label) }));
}

/**
 * They named a place. It leads, then the night is built around it: what they
 * asked for, plus what that place is known for, so "Bar Primi but louder"
 * lands on loud rooms with the same DNA.
 */
export function recommendAround(anchor: Venue, q: NightQuery, venues: Venue[], count = RESULT_COUNT): NightPick[] {
  const strong = (Object.entries(anchor.attrs) as [keyof Wants, number][])
    .filter(([k, v]) => v >= 0.7 && k !== "date" && k !== "groups")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const wants: Wants = { ...Object.fromEntries(strong.map(([k]) => [k, 0.45])), ...q.wants };
  const rest = recommendNight({ ...q, neighborhood: anchor.neighborhood, wants }, venues.filter((v) => v.slug !== anchor.slug), Math.max(1, count - 1));
  const { hits } = prefsScore(anchor, q.wants);
  const parts = hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];
  const lead: NightPick = { venue: anchor, label: "You said", score: 1, why: ["The one you named", ...parts].slice(0, 3).join(" · ") };
  return [lead, ...rest.map((p, i) => (i === 0 && p.label === "The pick" ? { ...p, label: "Also great" as PickLabel, why: p.why } : p))];
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
  const score = (fit * weights.fit + prefs * weights.prefs + nb * weights.nb + time * weights.time) * linePenalty(venue, q.wants) * beenPenalty(venue, q.wants, q.been) * verifiedBoost(venue);
  return { score, hits };
}

export function recommendDate(q: DateQuery, venues: Venue[], count = RESULT_COUNT): DatePlan[] {
  const bars: Scored[] = venues
    .filter((v) => v.kind === "bar")
    .map((venue) => ({ venue, r: scoreDateVenue(venue, q, { fit: 0.38, prefs: 0.4, nb: 0.12, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; r: { score: number; hits: AttrKey[] } } => x.r !== null)
    .map((x) => ({ venue: x.venue, score: x.r.score, hits: x.r.hits, group: x.venue.groupFit.two }))
    .sort((a, b) => b.score - a.score);

  const hitWords = (hits: AttrKey[]) => hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];

  if (!q.dinner) {
    return diversify(bars, "two", count).map(({ s, label }) => ({
      bar: s.venue,
      label,
      score: s.score,
      drinksAt: q.hour,
      why: [STAGE_WORD[q.stage], ...hitWords(s.hits), label === "Easy in" ? "Room to walk in" : null].filter(Boolean).slice(0, 3).join(" · "),
    }));
  }

  const restaurants: Scored[] = venues
    .filter((v) => v.kind === "restaurant")
    .map((venue) => ({ venue, r: scoreDateVenue(venue, q, { fit: 0.45, prefs: 0.3, nb: 0.15, time: 0.1 }) }))
    .filter((x): x is { venue: Venue; r: { score: number; hits: AttrKey[] } } => x.r !== null)
    .map((x) => ({ venue: x.venue, score: x.r.score, hits: x.r.hits, group: x.venue.groupFit.two }))
    .sort((a, b) => b.score - a.score);

  return pairWithBars(diversify(restaurants, "two", count), bars, q.hour, (r, bar, walk) =>
    [STAGE_WORD[q.stage], ...hitWords([...r.hits, ...bar.hits]), `${walk} min walk between`].slice(0, 3).join(" · "),
  );
}

/** Each restaurant gets the best bar within a short walk; bars aren't reused. */
function pairWithBars(
  picks: { s: Scored; label: PickLabel }[],
  bars: Scored[],
  dinnerAt: number,
  why: (r: Scored, bar: Scored, walk: number) => string,
): DatePlan[] {
  const plans: DatePlan[] = [];
  const usedBars = new Set<string>();
  for (const { s: r, label } of picks) {
    const candidates = bars
      .filter((b) => !usedBars.has(b.venue.slug))
      .map((b) => ({ ...b, dist: haversineMeters(r.venue, b.venue) }))
      .filter((b) => b.dist <= 900)
      .map((b) => ({ ...b, combined: b.score * (1 - Math.min(b.dist, 900) / 3000) }))
      .sort((a, b) => b.combined - a.combined);
    const bar = candidates[0] ?? bars.find((b) => !usedBars.has(b.venue.slug)) ?? bars[0];
    if (!bar) continue;
    usedBars.add(bar.venue.slug);
    const dist = haversineMeters(r.venue, bar.venue);
    const walk = Math.max(2, Math.round(dist / 80));
    const drinksAt = Math.round((dinnerAt + 1.75) * 4) / 4;
    plans.push({ restaurant: r.venue, bar: bar.venue, label, score: r.score, dinnerAt, drinksAt, walkMinutes: walk, why: why(r, bar, walk) });
  }
  return plans;
}

/* ───────────────────────── DINNER & DRINKS (groups) ───────────────────────── */

/**
 * A restaurant that fits everyone, then a bar nearby that fits everyone too.
 * Group fit and room size matter most; the deck's wants (share plates, loud or
 * calm, splurge, dancing after) steer both stops.
 */
export function recommendDinner(q: DinnerQuery, venues: Venue[], count = RESULT_COUNT): DatePlan[] {
  const bucket = groupBucket(q.group);
  const score = (venue: Venue, w: { nb: number; group: number; time: number; prefs: number }): Scored | null => {
    const nb = neighborhoodScore(venue, q.neighborhood);
    if (nb === null) return null;
    const group = venue.groupFit[bucket];
    const time = timeScore(venue, q.hour, q.dow);
    const { score: prefs, hits } = prefsScore(venue, q.wants);
    const base = nb * w.nb + group * w.group + time * w.time + prefs * w.prefs;
    return { venue, score: base * capacityPenalty(venue, bucket) * linePenalty(venue, q.wants) * beenPenalty(venue, q.wants, q.been) * verifiedBoost(venue), hits, group };
  };
  const restaurants = venues
    .filter((v) => v.kind === "restaurant")
    .map((v) => score(v, { nb: 0.18, group: 0.32, time: 0.12, prefs: 0.38 }))
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score);
  const bars = venues
    .filter((v) => v.kind === "bar")
    .map((v) => score(v, { nb: 0.14, group: 0.3, time: 0.14, prefs: 0.42 }))
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score);

  const hitWords = (hits: AttrKey[]) => hits.slice(0, 2).map((h) => HIT_WORD[h]).filter(Boolean) as string[];
  return pairWithBars(diversify(restaurants, bucket, count), bars, q.hour, (r, bar, walk) =>
    [`Table for ${groupWord(q.group)}`, ...hitWords([...r.hits, ...bar.hits]), `${walk} min walk between`].slice(0, 3).join(" · "),
  );
}

/** Labels for the attribute chips on venue pages, derived from strong attrs. */
export function strongAttrLabels(venue: Venue, max = 4): string[] {
  return (Object.entries(venue.attrs) as [AttrKey, number][])
    .filter(([, v]) => v >= 0.8)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => ATTRS[k].label)
    .slice(0, max);
}

/* ───────────────────────── NEAR ME ───────────────────────── */

export type NearQuery = { lat: number; lng: number; hour: number; dow: number; wants?: Wants; radius?: number; /** The place they're standing at, if it's one of ours: never recommended to itself. */ exclude?: string };

export type NearPick = NightPick & { meters: number; walkMinutes: number };

/**
 * Bars within a short walk of a point, best first.
 *
 * With no specifics ("bars near Bayard's"), the ranking system does the
 * talking: verified places first, then how close, then ROUND's score, with
 * "good right now" as a tiebreak. With specifics, what they asked for
 * matters as much as the walk.
 */
export function recommendNear(q: NearQuery, venues: Venue[], count = RESULT_COUNT): NearPick[] {
  const radius = q.radius ?? 1500;
  const wants = q.wants ?? {};
  const hasWants = Object.keys(wants).length > 0;
  const scored = venues
    .filter((v) => v.kind === "bar" && v.slug !== q.exclude)
    .map((venue) => {
      const meters = haversineMeters(q, venue);
      if (meters > radius) return null;
      const near = 1 - meters / radius;
      const time = timeScore(venue, q.hour, q.dow);
      const { score: prefs, hits } = prefsScore(venue, wants);
      const rating = typeof venue.score === "number" ? venue.score / 100 : 0.65;
      const score = hasWants
        ? (near * 0.4 + time * 0.2 + prefs * 0.25 + rating * 0.1 + venue.easyIn * 0.05) * verifiedBoost(venue)
        : (near * 0.45 + time * 0.15 + rating * 0.2 + (venue.verified ? 0.15 : 0) + venue.easyIn * 0.05) * scoreBoost(venue);
      return { venue, meters, score, hits, time };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  const labels: PickLabel[] = ["The pick", "Also great", "Easy in", "Sleeper", "Wildcard", "Classic", "Late one", "Big room"];
  return scored.map((s, i) => {
    const walk = Math.max(1, Math.round(s.meters / 80));
    const label: PickLabel = i === 0 ? "The pick" : i === 1 ? "Also great" : s.venue.easyIn >= 0.7 && i === 2 ? "Easy in" : labels[Math.min(i, labels.length - 1)];
    const parts = [`${walk} min walk`, ...s.hits.slice(0, 1).map((h) => HIT_WORD[h]).filter(Boolean), s.time >= 1 ? "Good right now" : null].filter(Boolean) as string[];
    return { venue: s.venue, label, score: s.score, why: parts.slice(0, 3).join(" · "), meters: s.meters, walkMinutes: walk };
  });
}
