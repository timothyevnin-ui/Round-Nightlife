import { recommendDate, recommendNight } from "./engine";
import type { NeighborhoodId, Venue } from "./types";

/** The indexable "Best bars in X for Y" pages — same engine, rendered as a list. */
export type Occasion = {
  id: string;
  title: (hood: string) => string;
  blurb: (hood: string) => string;
  pick: (n: NeighborhoodId) => Venue[];
};

const DOW_SAT = 6;
const DOW_THU = 4;

export const OCCASIONS: Occasion[] = [
  {
    id: "big-group",
    title: (h) => `Best bars in ${h} for a big group`,
    blurb: (h) => `Where eight or more of you can actually get in, sit down, and hear each other enough to argue about the next place. ROUND's picks for ${h}.`,
    pick: (n) => uniq([...recommendNight({ neighborhood: n, vibe: "lively", group: 8, hour: 22, dow: DOW_SAT }).map((p) => p.venue), ...recommendNight({ neighborhood: n, vibe: "chill", group: 8, hour: 21, dow: DOW_THU }).map((p) => p.venue)]),
  },
  {
    id: "date",
    title: (h) => `Best date bars in ${h}`,
    blurb: (h) => `Low light, good drinks, and rooms where a conversation can go somewhere. ROUND's date picks in ${h}, first date to fifth.`,
    pick: (n) => uniq([...recommendDate({ neighborhood: n, stage: "first", dinner: false, vibe: "talk", hour: 21, dow: DOW_THU }).map((p) => p.bar), ...recommendDate({ neighborhood: n, stage: "early", dinner: false, vibe: "lowlit", hour: 22, dow: DOW_SAT }).map((p) => p.bar)]),
  },
  {
    id: "can-actually-talk",
    title: (h) => `Bars in ${h} where you can actually talk`,
    blurb: (h) => `No shouting, no DJ, no standing three-deep at the bar. The quiet-enough rooms in ${h}, according to ROUND.`,
    pick: (n) => uniq([...recommendNight({ neighborhood: n, vibe: "talk", group: 2, hour: 21, dow: DOW_THU }).map((p) => p.venue), ...recommendNight({ neighborhood: n, vibe: "talk", group: 4, hour: 20, dow: DOW_SAT }).map((p) => p.venue)]),
  },
  {
    id: "lively",
    title: (h) => `Liveliest bars in ${h} tonight`,
    blurb: (h) => `Loud, social, a little crowded on purpose. Where ${h} goes when the plan is a night, not a drink.`,
    pick: (n) => uniq([...recommendNight({ neighborhood: n, vibe: "lively", group: 4, hour: 23, dow: DOW_SAT }).map((p) => p.venue), ...recommendNight({ neighborhood: n, vibe: "lively", group: 6, hour: 22, dow: DOW_THU }).map((p) => p.venue)]),
  },
];

function uniq(vs: Venue[]) {
  const seen = new Set<string>();
  return vs.filter((v) => (seen.has(v.slug) ? false : (seen.add(v.slug), true))).slice(0, 5);
}

export const OCCASION_MAP = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));
