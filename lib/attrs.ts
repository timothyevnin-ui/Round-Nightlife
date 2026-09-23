import type { Attrs } from "./types";
/**
 * The attribute registry. Every swipe-deck question, every "just say it"
 * keyword, and every chip in the back office maps to one of these keys.
 * Values on a venue are 0–1 (the back office uses no / some / yes = 0 / 0.5 / 1).
 */

export const ATTR_GROUPS = [
  { id: "energy", label: "Energy" },
  { id: "room", label: "The room" },
  { id: "music", label: "Music & sport" },
  { id: "drinks", label: "Drinks & food" },
  { id: "money", label: "Money & bougie" },
  { id: "when", label: "When" },
  { id: "who", label: "Who it's for" },
] as const;

export type AttrGroup = (typeof ATTR_GROUPS)[number]["id"];

export type AttrDef = {
  key: AttrKey;
  label: string;
  group: AttrGroup;
  /** One-line hint for the back office. */
  hint: string;
  /** Words that map free text onto this attribute. */
  keywords: string[];
  /** Attributes that this one tends to contradict — used for "no" answers. */
  opposes?: AttrKey[];
};

export const ATTR_KEYS = [
  "lively",
  "talk",
  "chill",
  "dance",
  "liveMusic",
  "sports",
  "seating",
  "outdoor",
  "rooftop",
  "speakeasy",
  "classic",
  "dive",
  "upscale",
  "scene",
  "cocktails",
  "beer",
  "wine",
  "frozen",
  "food",
  "cheap",
  "dressy",
  "late",
  "happyHour",
  "social",
  "date",
  "groups",
  "activity",
  "lgbtq",
  "daytime",
] as const;

export type AttrKey = (typeof ATTR_KEYS)[number];

export const ATTRS: Record<AttrKey, AttrDef> = {
  lively: { key: "lively", label: "Lively / loud", group: "energy", hint: "Standing, shouting, a pulse.", keywords: ["lively", "loud", "crowded", "packed", "rowdy", "party", "energy", "buzzy", "wild", "turn up"], opposes: ["talk", "chill"] },
  talk: { key: "talk", label: "Can actually talk", group: "energy", hint: "You'll hear every word.", keywords: ["talk", "quiet", "conversation", "hear", "catch up", "chat", "low key", "lowkey", "mellow"], opposes: ["lively", "dance"] },
  chill: { key: "chill", label: "Chill / sit and stay", group: "energy", hint: "Slow night, nobody rushing you.", keywords: ["chill", "relax", "relaxed", "slow", "easy", "casual", "hang"], opposes: ["lively"] },
  dance: { key: "dance", label: "Dancing / DJ", group: "music", hint: "People are actually dancing.", keywords: ["dance", "dancing", "dj", "club", "boogie", "move"], opposes: ["talk", "chill"] },
  liveMusic: { key: "liveMusic", label: "Live music", group: "music", hint: "A band, a piano, a set.", keywords: ["live music", "band", "jazz", "live", "show", "set", "piano", "country", "honky"] },
  sports: { key: "sports", label: "Screens for the game", group: "music", hint: "TVs with sound and people who care.", keywords: ["sports", "game", "tv", "tvs", "screens", "watch", "football", "soccer", "knicks", "giants", "jets", "yankees", "mets", "nets", "rangers", "ufc", "fight", "match"] },
  seating: { key: "seating", label: "Easy to get a seat", group: "room", hint: "Tables, booths, a real chance of sitting.", keywords: ["sit", "seat", "seats", "seating", "table", "tables", "booth", "booths", "sit down", "chairs"] },
  outdoor: { key: "outdoor", label: "Outdoor space", group: "room", hint: "Backyard, patio, sidewalk.", keywords: ["outdoor", "outside", "backyard", "patio", "garden", "sidewalk", "al fresco", "terrace"] },
  rooftop: { key: "rooftop", label: "Rooftop / views", group: "room", hint: "Up high, skyline.", keywords: ["rooftop", "roof", "view", "views", "skyline"] },
  speakeasy: { key: "speakeasy", label: "Hidden / speakeasy", group: "room", hint: "Unmarked door, a little theater.", keywords: ["speakeasy", "hidden", "secret", "unmarked", "password"] },
  classic: { key: "classic", label: "Old New York", group: "room", hint: "Wood, brass, been there forever.", keywords: ["old", "classic", "historic", "old school", "old-school", "institution", "tavern", "old new york"] },
  dive: { key: "dive", label: "Dive", group: "room", hint: "Cheap, dark, no pretense.", keywords: ["dive", "divey", "grimy", "no frills", "gritty"], opposes: ["upscale", "dressy", "scene"] },
  upscale: { key: "upscale", label: "Upscale / polished", group: "money", hint: "Nice glassware, nice lighting.", keywords: ["upscale", "nice", "fancy", "polished", "elegant", "classy", "swanky", "bougie", "boujee", "chic"], opposes: ["dive", "cheap"] },
  scene: { key: "scene", label: "Sceney", group: "who", hint: "Doorman energy, people who dressed for it.", keywords: ["scene", "sceney", "trendy", "hot", "cool crowd", "models", "it spot", "hype"] },
  cocktails: { key: "cocktails", label: "Cocktail-forward", group: "drinks", hint: "The drinks are the point.", keywords: ["cocktail", "cocktails", "martini", "martinis", "negroni", "mixology", "craft"] },
  beer: { key: "beer", label: "Beer / pints", group: "drinks", hint: "Taps, pints, pitchers.", keywords: ["beer", "beers", "pint", "pints", "pitcher", "brew", "ipa", "lager", "pub"] },
  wine: { key: "wine", label: "Wine bar", group: "drinks", hint: "Natural, orange, by the glass.", keywords: ["wine", "natural wine", "vino", "glass of"] },
  frozen: { key: "frozen", label: "Frozen drinks", group: "drinks", hint: "Slushies, margs, the machine.", keywords: ["frozen", "slushie", "slushy", "marg", "margs", "margarita", "daiquiri"] },
  food: { key: "food", label: "Real food", group: "drinks", hint: "You can eat here without regret.", keywords: ["food", "eat", "dinner", "fries", "burger", "burgers", "oysters", "snacks", "hungry", "pizza", "tacos", "wings"] },
  cheap: { key: "cheap", label: "Cheap drinks", group: "money", hint: "Under $10 a drink, mostly.", keywords: ["cheap", "budget", "broke", "affordable", "inexpensive", "deal", "deals", "under"], opposes: ["upscale"] },
  // No dress codes in ROUND. This is the "people dressed for it" half of bougie: a scene you'd put a shirt on for.
  dressy: { key: "dressy", label: "Bougie crowd", group: "money", hint: "People came dressed for it.", keywords: ["dressed", "dressy", "dress up", "dressed up", "heels", "suit", "glam", "bougie", "boujee", "bouje"], opposes: ["dive"] },
  late: { key: "late", label: "Late night (2am+)", group: "when", hint: "Still going at 2.", keywords: ["late", "late night", "2am", "3am", "4am", "after hours", "all night", "afters", "last call"] },
  happyHour: { key: "happyHour", label: "Good happy hour", group: "when", hint: "A real deal before 8.", keywords: ["happy hour", "hh", "after work", "5pm", "6pm", "early"] },
  social: { key: "social", label: "Meet new people", group: "who", hint: "Strangers talk to each other here.", keywords: ["meet", "meet people", "single", "singles", "mingle", "social", "flirty", "strangers", "new people"] },
  date: { key: "date", label: "Date-y / romantic", group: "who", hint: "Low light, two seats, no shouting.", keywords: ["date", "romantic", "intimate", "candlelit", "cozy", "cosy", "anniversary"] },
  groups: { key: "groups", label: "Big group friendly", group: "who", hint: "Eight of you won't be a problem.", keywords: ["group", "groups", "big group", "birthday", "party of", "all of us", "crew", "squad", "everyone"] },
  activity: { key: "activity", label: "Something to do", group: "music", hint: "Pool, darts, karaoke, a show.", keywords: ["pool", "darts", "karaoke", "games", "arcade", "trivia", "bowling", "ping pong", "skee", "shuffleboard", "activity", "something to do"] },
  lgbtq: { key: "lgbtq", label: "LGBTQ+ night", group: "who", hint: "Queer-owned, queer-loved, or the night is.", keywords: ["gay", "queer", "lgbtq", "lgbt", "drag", "pride"] },
  daytime: { key: "daytime", label: "Good in daylight", group: "when", hint: "A place to drink at 3pm: sun, a game, a deal, no shame.", keywords: ["day", "daytime", "day drinking", "afternoon", "brunch", "sunday funday", "sunny", "in the sun", "day drink", "boozy brunch", "lunch"] },
};

/** Where a place lands in daylight when nobody has said: outside, a game, a deal, or a rooftop carry it. */
export function deriveDaytime(a: Pick<Attrs, "outdoor" | "rooftop" | "sports" | "happyHour" | "cheap" | "food">): number {
  return Math.max(0.15, a.outdoor, a.rooftop, a.sports * 0.85, a.happyHour * 0.7, Math.min(a.cheap, a.food) * 0.6);
}

export const ATTR_LIST: AttrDef[] = ATTR_KEYS.map((k) => ATTRS[k]);

export function attrsByGroup(group: AttrGroup) {
  return ATTR_LIST.filter((a) => a.group === group);
}

/** Editorial tags the back office suggests; free text is also allowed. */
export const SUGGESTED_TAGS = [
  "Lively",
  "Chill",
  "Can Actually Talk",
  "Dancing",
  "Live Music",
  "Jazz",
  "Sports",
  "Late Night",
  "Cocktails",
  "Beer",
  "Wine",
  "Dive",
  "Speakeasy",
  "Old NYC",
  "Rooftop",
  "Backyard",
  "Groups",
  "Date",
  "First Date",
  "Cheap",
  "Upscale",
  "Sceney",
  "Food",
  "Frozen Drinks",
  "Karaoke",
  "Pool Table",
  "Happy Hour",
  "Meet People",
  "Corner Bar",
  "Hotel Bar",
  "Pub",
  "Aperitivo",
  "Tiny",
  "Big Room",
];
