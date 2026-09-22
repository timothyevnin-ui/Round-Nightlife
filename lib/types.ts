export type NeighborhoodId =
  | "west-village"
  | "east-village"
  | "lower-east-side"
  | "soho-nolita"
  | "tribeca"
  | "chelsea"
  | "williamsburg"
  | "greenpoint";

export type Vibe = "lively" | "chill" | "talk";
export type DateVibe = "talk" | "lowlit" | "lively";
export type GroupBucket = "two" | "small" | "mid" | "big"; // 2 · 3–4 · 5–7 · 8+
export type DateStage = "first" | "early" | "longterm";
export type Capacity = "tiny" | "small" | "medium" | "large";
export type Mode = "night" | "date";

export type Window = {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** 24h. `to` may exceed 24 to express after-midnight (e.g. 26 = 2am). */
  from: number;
  to: number;
};

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
  /** The thing Maps doesn't know. */
  theCatch?: string;
  tags: string[];
  vibe: Record<Vibe, number>;
  groupFit: Record<GroupBucket, number>;
  dateFit: Record<DateStage, number>;
  price: 1 | 2 | 3 | 4;
  capacity: Capacity;
  bestWindows: Window[];
  /** 0..1 — how likely a group can walk in at peak without a wait. */
  easyIn: number;
  /** Placeholder art until real photography: two colors and an angle. */
  photo: { from: string; to: string; angle?: number };
  /** Seeded social proof for the demo; becomes real with the friend graph. */
  friendsBeen?: number;
  /** Membership perk slot — unused in V1, wired for later. */
  perk?: string;
  /** ROUND Table slot — unused in V1, wired for later. */
  groupBooking?: { maxGroup: number; minSpend?: number; contact?: string };
  /** Seed data is unverified until a human has been and says yes. */
  verified: boolean;
  sources?: string[];
};

export type NightQuery = {
  neighborhood: NeighborhoodId;
  vibe: Vibe;
  group: number; // 2..11 (11 = 11+)
  hour: number; // 24h, may be 24+ for after midnight
  dow: number; // 0..6
};

export type DateQuery = {
  neighborhood: NeighborhoodId;
  stage: DateStage;
  dinner: boolean;
  vibe: DateVibe;
  hour: number;
  dow: number;
};

export type PickLabel = "The pick" | "Also great" | "Easy in";

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
