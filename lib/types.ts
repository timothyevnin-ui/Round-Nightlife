import type { AttrKey } from "./attrs";
import type { Wants } from "./questions";

export type NeighborhoodId =
  | "west-village"
  | "east-village"
  | "lower-east-side"
  | "soho-nolita"
  | "tribeca"
  | "chelsea"
  | "williamsburg"
  | "greenpoint";

export type GroupBucket = "two" | "small" | "mid" | "big"; // 2 · 3–4 · 5–7 · 8+
export type DateStage = "first" | "early" | "longterm";
export type Capacity = "tiny" | "small" | "medium" | "large";
export type Mode = "night" | "date" | "dinner";

export type Window = {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** 24h. `to` may exceed 24 to express after-midnight (e.g. 26 = 2am). */
  from: number;
  to: number;
};

export type Attrs = Record<AttrKey, number>;

/**
 * Posted hours, one entry per weekday (0 = Sunday). "HH:MM" in 24h; a close
 * time earlier than the open time means after midnight ("02:00" = 2am).
 * null = closed that day. Absent entirely = we don't know yet (never shown).
 */
export type DayHours = { open: string; close: string } | null;
export type Hours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

export type Venue = {
  slug: string;
  name: string;
  kind: "bar" | "restaurant";
  neighborhood: NeighborhoodId;
  address: string;
  lat: number;
  lng: number;
  /** ROUND's Take — one sentence, in the house voice. */
  take: string;
  /** ROUND's score, 0–100: how much we like it. Set in Studio; shown only once set. */
  score?: number;
  /** The day deal, one line: "$5 pitchers till 6". Shown with the hours. */
  dayDeal?: string;
  /** Posted hours, when known. */
  hours?: Hours;
  /** A bar with a real food menu (kitchen, not just a bowl of nuts). */
  barFood?: boolean;
  /** What kind of food: "Italian", "Cheesesteaks", "Tacos". Restaurants and bars with food. */
  cuisine?: string;
  /** The thing Maps doesn't know. */
  theCatch?: string;
  tags: string[];
  /** 0–1 per attribute. The engine, the deck and the back office all speak this. */
  attrs: Attrs;
  groupFit: Record<GroupBucket, number>;
  dateFit: Record<DateStage, number>;
  price: 1 | 2 | 3 | 4;
  capacity: Capacity;
  bestWindows: Window[];
  /** 0..1 — how likely a group can walk in at peak without a wait. */
  easyIn: number;
  /** Placeholder art until real photography: two colors and an angle. */
  photo: { from: string; to: string; angle?: number };
  /** A real photo, once one exists. */
  photoUrl?: string;
  /** Who to credit for the photo (Wikimedia Commons uploads ask for this). */
  photoCredit?: string;
  /** Seeded social proof for the demo; becomes real with the friend graph. */
  friendsBeen?: number;
  /** Membership perk slot — unused in V1, wired for later. */
  perk?: string;
  /** ROUND Table slot — unused in V1, wired for later. */
  groupBooking?: { maxGroup: number; minSpend?: number; contact?: string };
  /** Seed data is unverified until a human has been and says yes. */
  verified: boolean;
  /** Private notes from the back office (never rendered publicly). */
  notes?: string;
  sources?: string[];
  /** On the home page's "What's hot right now" shelf. */
  hot?: boolean;
  /** Lower comes first on the shelf. */
  hotRank?: number;
  /** The long read: ROUND's write-up, paragraphs separated by blank lines. */
  story?: string;
};

/** The three energy numbers, read off attrs. */
export function vibeOf(v: Pick<Venue, "attrs">) {
  return { lively: v.attrs.lively, chill: v.attrs.chill, talk: v.attrs.talk };
}

export type NightQuery = {
  neighborhood: NeighborhoodId;
  group: number; // 2..11 (11 = 11+)
  hour: number; // 24h, may be 24+ for after midnight
  dow: number; // 0..6
  wants: Wants;
  /** Slugs the person has already been to — used by the "somewhere new" want. */
  been?: string[];
};

export type DateQuery = {
  neighborhood: NeighborhoodId;
  stage: DateStage;
  dinner: boolean;
  hour: number;
  dow: number;
  wants: Wants;
  been?: string[];
};

/** Dinner and drinks for a group: a restaurant that fits everyone, then a bar nearby. */
export type DinnerQuery = {
  neighborhood: NeighborhoodId;
  group: number;
  hour: number;
  dow: number;
  wants: Wants;
  been?: string[];
};

export type PickLabel = "The pick" | "You said" | "Also great" | "Easy in" | "Wildcard" | "Sleeper" | "Late one" | "Splurge" | "Cheap and good" | "Big room" | "Classic";

export type NightPick = {
  venue: Venue;
  label: PickLabel;
  score: number;
  why: string;
};

export type DatePlan = {
  restaurant?: Venue;
  bar: Venue;
  label: PickLabel;
  score: number;
  dinnerAt?: number; // hour, decimal
  drinksAt: number;
  walkMinutes?: number;
  why: string;
};
