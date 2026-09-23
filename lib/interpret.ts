import { ATTR_LIST, type AttrKey } from "./attrs";
import { NEIGHBORHOODS } from "./neighborhoods";
import { nowInNYC, timeOptions } from "./time";
import type { Wants } from "./questions";
import type { DateStage, NeighborhoodId, Venue } from "./types";
import { findVenueInText } from "./match";

/**
 * "Just say it." Turns a sentence into the same structured query the deck
 * produces. The keyword parser runs everywhere; when an Anthropic key is set,
 * the API route asks Claude and falls back to this if anything goes wrong.
 */

export type Interpretation = {
  mode: "night" | "date" | "dinner";
  neighborhood?: NeighborhoodId;
  group?: number;
  hour?: number;
  stage?: DateStage;
  dinner?: boolean;
  wants: Wants;
  /** What the parser understood, for the confirmation line. */
  understood: string[];
  /** A place they named ("Bar Primi", "near McSorley's"). */
  venue?: { slug: string; name: string; neighborhood: NeighborhoodId; lat: number; lng: number };
  /** They want places around that venue, not the venue itself. */
  near?: boolean;
  /** A street, corner, landmark or address they mentioned (not a ROUND place): "near Bleecker", "by Washington Square". */
  place?: { label: string; lat: number; lng: number };
};

export type VenueForMatch = Pick<Venue, "slug" | "name" | "neighborhood" | "lat" | "lng">;

// Names, nicknames, and the streets and landmarks people actually say.
const HOOD_ALIASES: Record<NeighborhoodId, string[]> = {
  "west-village": ["west village", "wv", "w village", "west vill", "greenwich village", "the village", "bleecker", "bleeker", "macdougal", "mcdougal", "christopher st", "christopher street", "washington square", "wash sq", "carmine", "cornelia", "grove st", "hudson st", "7th ave south", "seventh ave south", "sheridan square", "sheridan sq", "west 4th", "w 4th", "nyu"],
  "east-village": ["east village", "ev", "e village", "east vill", "alphabet city", "st marks", "st. marks", "saint marks", "avenue a", "avenue b", "avenue c", "ave a", "ave b", "ave c", "tompkins", "2nd ave", "second ave", "1st ave", "first ave", "east 7th", "e 7th", "cooper square", "astor place", "astor pl"],
  "lower-east-side": ["lower east side", "les", "l.e.s", "lower east", "chinatown", "two bridges", "dimes square", "ludlow", "orchard st", "orchard street", "delancey", "rivington", "stanton", "essex", "clinton st", "canal st", "canal street", "allen st"],
  "soho-nolita": ["soho", "nolita", "noho", "little italy", "prince st", "prince street", "spring st", "spring street", "mulberry", "elizabeth st", "elizabeth street", "mott st", "mott street", "kenmare", "lafayette", "bowery", "bond st", "bond street", "great jones"],
  tribeca: ["tribeca", "fidi", "financial district", "west broadway", "duane", "hudson square", "chambers", "warren st", "greenwich st", "stone street", "stone st"],
  chelsea: ["chelsea", "meatpacking", "west 20s", "flatiron", "high line", "highline", "gansevoort", "little west 12th", "9th ave", "ninth ave", "10th ave", "tenth ave", "west 23rd", "w 23rd", "west 14th", "w 14th", "chelsea market", "union square", "union sq"],
  williamsburg: ["williamsburg", "wburg", "w'burg", "billyburg", "bedford ave", "bedford avenue", "bedford", "n 6th", "north 6th", "n 7th", "north 7th", "wythe", "berry st", "berry street", "metropolitan ave", "kent ave", "domino park", "south williamsburg"],
  greenpoint: ["greenpoint", "gp", "franklin st", "franklin street", "franklin ave", "manhattan ave", "manhattan avenue", "nassau ave", "nassau avenue", "mcguinness", "greenpoint ave", "transmitter park", "mccarren"],
};

const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 11, dozen: 11, couple: 2, few: 3, handful: 5 };

const NEGATORS = ["no", "not", "don't", "dont", "without", "never", "skip", "zero", "avoid", "isn't", "isnt", "aren't", "arent", "nothing"];

function findNeighborhood(text: string): NeighborhoodId | undefined {
  let best: { id: NeighborhoodId; len: number } | undefined;
  for (const [id, aliases] of Object.entries(HOOD_ALIASES) as [NeighborhoodId, string[]][]) {
    for (const a of aliases) {
      const re = new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      if (re.test(text) && (!best || a.length > best.len)) best = { id, len: a.length };
    }
  }
  return best?.id;
}

function findGroup(text: string): number | undefined {
  const m = text.match(/\b(\d{1,2})\s*(of us|people|ppl|friends|of them|guys|girls|folks|heads)\b/i) ?? text.match(/\b(party|group|table)\s*(of|for)\s*(\d{1,2})\b/i);
  if (m) {
    const n = Number(m[3] ?? m[1]);
    if (n >= 2 && n <= 40) return Math.min(11, n);
  }
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${w}\\s*(of us|people|friends|of them|guys|girls)\\b`, "i").test(text)) return n;
  }
  if (/\b(just me and|me and my|the two of us|date|my girlfriend|my boyfriend|my wife|my husband|a girl|a guy)\b/i.test(text)) return 2;
  if (/\b(big group|everyone|the whole|all of us|birthday|bachelor|bachelorette)\b/i.test(text)) return 9;
  return undefined;
}

function findHour(text: string): number | undefined {
  if (/\b(right now|now|asap|tonight now|already out)\b/i.test(text)) return nowHour();
  if (/\b(later|late night|after midnight|afters)\b/i.test(text) && !/\b\d{1,2}\s*(pm|:)/i.test(text)) return 24.5;
  // Daytime words mean daytime: this afternoon if it is one, otherwise a sensible day hour.
  if (/\b(brunch)\b/i.test(text)) return dayHour(12);
  if (/\b(happy hour|after work)\b/i.test(text)) return 17.5;
  if (/\b(day ?drink\w*|this afternoon|afternoon|daytime|during the day|day out|in the sun)\b/i.test(text)) return dayHour(14);
  // "Tonight" (or "tn") with no hour means tonight, not this minute: 9 while it's daytime, now in the evening.
  if (/\b(tonight|tn|this evening|later tonight)\b/i.test(text)) return timeOptions().defaultValue;
  const m = text.match(/\b(at|around|by|from|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(pm|p\.m\.|am|a\.m\.)?\b/i);
  if (m) {
    let h = Number(m[2]);
    const mins = m[3] ? Number(m[3]) / 60 : 0;
    const suffix = (m[4] ?? "").toLowerCase();
    if (h >= 1 && h <= 12) {
      if (suffix.startsWith("a")) {
        if (h <= 4) h += 24; // 1am = 25 (after midnight tonight)
      } else {
        if (h <= 11) h += 12; // assume pm for 1–11
        else if (h === 12) h = suffix.startsWith("p") ? 12 : 24;
      }
      return h + mins;
    }
    if (h >= 13 && h <= 23) return h + mins;
  }
  return undefined;
}

/** The clock, in ROUND hours (24+ after midnight). */
function nowHour(): number {
  const { hour, minute } = nowInNYC();
  return Math.round((hour < 5 ? hour + 24 : hour) * 4 + minute / 15) / 4;
}

/** A daytime hour: now if it's daytime already, otherwise `fallback`. */
function dayHour(fallback: number): number {
  const h = nowHour();
  return h >= 11 && h < 17 ? h : fallback;
}

function findStage(text: string): DateStage | undefined {
  if (/\b(first date|1st date|first time meeting|hinge|tinder|bumble|raya)\b/i.test(text)) return "first";
  if (/\b(anniversary|long ?term|my (wife|husband|partner|girlfriend|boyfriend)|been together)\b/i.test(text)) return "longterm";
  if (/\b(second date|third date|few dates|seeing someone|dating)\b/i.test(text)) return "early";
  return undefined;
}

/** Keyword pass. Handles simple negation: "no line", "not a club", "don't want to wait". Pass the venues to recognize a place by name. */
export function interpretText(raw: string, venues: VenueForMatch[] = []): Interpretation {
  const text = ` ${raw.toLowerCase().replace(/\s+/g, " ").trim()} `;
  const understood: string[] = [];
  const wants: Wants = {};

  const named = venues.length ? findVenueInText(raw, venues) : null;

  const isDate = /\b(date|romantic|anniversary|girlfriend|boyfriend|wife|husband|partner|hinge|tinder|bumble)\b/i.test(text);
  const wantsDinner = /\b(dinner|restaurant|eat first|eat somewhere|hungry|reservation|table for)\b/i.test(text);
  const mode: Interpretation["mode"] = isDate ? "date" : wantsDinner ? "dinner" : "night";

  const neighborhood = findNeighborhood(text);
  const group = findGroup(text);
  const hour = findHour(text);
  const stage = isDate ? findStage(text) : undefined;
  const dinner = isDate ? wantsDinner : undefined;

  // Attribute keywords with a small negation window.
  const words = text.split(" ");
  const BREAKERS = ["but", "and", "then", "though", "although", "plus", "also", "with"];
  const negatedAt = (idx: number) => {
    // Look back up to three words, but never across punctuation or a conjunction.
    for (let k = idx - 1; k >= Math.max(0, idx - 3); k--) {
      const raw = words[k];
      const w = raw.replace(/[^a-z']/g, "");
      if (NEGATORS.includes(w)) return true;
      if (/[,.;!?]$/.test(raw) || BREAKERS.includes(w)) return false;
    }
    return false;
  };
  for (const def of ATTR_LIST) {
    for (const kw of def.keywords) {
      const re = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      const m = re.exec(text);
      if (!m) continue;
      const idx = text.slice(0, m.index + 1).split(" ").length - 1;
      const neg = negatedAt(idx);
      const val = neg ? -0.8 : 1;
      wants[def.key] = Math.max(-1, Math.min(1, (wants[def.key] ?? 0) + val));
      if (!neg) for (const o of def.opposes ?? []) wants[o] = Math.max(-1, Math.min(1, (wants[o] ?? 0) - 0.4));
      understood.push(neg ? `not ${def.label.toLowerCase()}` : def.label.toLowerCase());
      break;
    }
  }
  if (/\b(no (line|lines|wait|waiting|queue)|not impossible|can (actually )?get in|walk (right )?in|don'?t want to wait|without (a )?(line|wait))\b/i.test(text)) {
    wants.noLine = 1;
    understood.push("no line");
  }
  if (/\b(somewhere new|never been|haven'?t been|new place|new spot)\b/i.test(text)) {
    wants.new = 1;
    understood.push("somewhere new");
  }
  if (/\b(not a club|no club|no clubs|not clubby)\b/i.test(text)) {
    wants.scene = -0.7;
    wants.dressy = Math.min(wants.dressy ?? 0, -0.3);
    understood.push("not a club");
  }

  if (neighborhood) understood.unshift(NEIGHBORHOODS.find((n) => n.id === neighborhood)!.name);
  if (group) understood.push(group >= 11 ? "11+ of you" : `${group} of you`);

  const out: Interpretation = { mode, neighborhood, group, hour, stage, dinner, wants, understood: [...new Set(understood)].slice(0, 7) };
  if (named) {
    const v = named.venue;
    out.venue = { slug: v.slug, name: v.name, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng };
    out.near = named.near;
    if (!out.neighborhood) out.neighborhood = v.neighborhood;
    out.understood = [named.near ? `near ${v.name}` : v.name, ...out.understood.filter((u) => u.toLowerCase() !== v.name.toLowerCase())].slice(0, 7);
  }
  return out;
}

/** Prompt for the model-backed version; returns the same shape. Knows every place on ROUND by name. */
export function interpretPrompt(text: string, venues: VenueForMatch[] = []) {
  const attrs = ATTR_LIST.map((a) => `${a.key}: ${a.label}`).join("\n");
  const hoods = NEIGHBORHOODS.map((n) => n.id).join(", ");
  const places = venues.map((v) => `${v.slug} (${v.name}, ${v.neighborhood})`).join("; ");
  return (
    `Turn this sentence about going out in NYC into JSON for a bar recommender.\n` +
    `Sentence: """${text}"""\n\n` +
    `Return only JSON: {"mode":"night"|"date"|"dinner" (dinner = a group wants to eat first, then drinks),"neighborhood": one of [${hoods}] or null,"group": integer 2-11 or null,"hour": number (24h, 24-27 for after midnight) only when they name a time or a part of the day (brunch = 12, happy hour = 17.5, afternoon = 14); "tonight" alone is null,` +
    `"stage":"first"|"early"|"longterm"|null,"dinner": boolean|null,"wants": {attribute: number in -1..1}, "understood": [short phrases], "venue": slug or null, "near": boolean, "place": {"label": string, "lat": number, "lng": number} or null}\n` +
    `Neighborhoods, with the streets and landmarks that belong to them: west-village = Greenwich Village too (Bleecker, MacDougal, Christopher, Hudson St, Washington Square, NYU); east-village (St Marks, Avenues A-C, Tompkins Square, Astor Place); lower-east-side (Ludlow, Orchard, Delancey, Rivington, Chinatown, Dimes Square); soho-nolita (Prince, Spring, Mulberry, Elizabeth, Mott, the Bowery, NoHo); tribeca (West Broadway, Duane, Hudson Square, FiDi); chelsea (Meatpacking, the High Line, Flatiron, Union Square); williamsburg (Bedford Ave, N 6th, Wythe, Domino Park); greenpoint (Franklin St, Manhattan Ave, Nassau Ave, McCarren Park).\n` +
    `"place": when they mention a street, corner, landmark, park, subway stop or address in New York that is NOT one of the ROUND places below ("near Bleecker", "by Washington Square", "around Delancey and Essex", "I'm at the Bedford L"), give its short label and its coordinates as precisely as you can, and set "neighborhood" to the neighborhood it's in. Otherwise null. Spelling is often off (Bleeker = Bleecker).\n` +
    `Attributes (use only these keys; positive = wants it, negative = wants to avoid it; also allowed: "noLine" for no waiting, "new" for somewhere they haven't been):\n${attrs}\n` +
    (places
      ? `Places ROUND knows (slug (name, neighborhood)). If the sentence names one of them, even misspelled or shortened, set "venue" to its slug and "neighborhood" to its neighborhood; set "near": true only if they want places around it ("near", "by", "I'm at") rather than that place itself. Names that are just common words ("Local", "Diner") only count when clearly used as a place name.\n${places}\n`
      : "") +
    `If they name a place and describe what they want ("like Bar Primi but louder"), fill "wants" from the description. Be literal. Don't invent a neighborhood or group size that isn't stated.`
  );
}

export function toResultsParams(i: Interpretation, fallbackDow: number, said?: string): URLSearchParams {
  const p = new URLSearchParams();
  const q = (said ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (q) p.set("q", q);
  const spot = i.venue && i.near ? { label: i.venue.name, lat: i.venue.lat, lng: i.venue.lng } : !i.venue && i.place ? i.place : null;
  if (spot) {
    p.set("m", "near");
    p.set("lat", spot.lat.toFixed(5));
    p.set("lng", spot.lng.toFixed(5));
    p.set("at", spot.label);
    if (i.neighborhood) p.set("n", i.neighborhood);
    p.set("t", String(i.hour ?? timeOptions().defaultValue));
    p.set("d", String(fallbackDow));
    if (i.mode === "date") {
      p.set("s", i.stage ?? "early");
      p.set("dn", i.dinner === false ? "0" : "1");
    } else p.set("g", String(i.group ?? 4));
    const w = Object.entries(i.wants)
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([k, v]) => `${k}:${Number((v as number).toFixed(2))}`)
      .join(",");
    if (w) p.set("w", w);
    return p;
  }
  p.set("m", i.mode);
  if (i.venue) p.set("a", i.venue.slug);
  p.set("n", i.neighborhood ?? "west-village");
  p.set("t", String(i.hour ?? timeOptions().defaultValue));
  p.set("d", String(fallbackDow));
  if (i.mode === "night" || i.mode === "dinner") p.set("g", String(i.group ?? 4));
  else {
    p.set("s", i.stage ?? "early");
    p.set("dn", i.dinner === false ? "0" : "1");
  }
  const w = Object.entries(i.wants)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([k, v]) => `${k}:${Number((v as number).toFixed(2))}`)
    .join(",");
  if (w) p.set("w", w);
  return p;
}

export type { AttrKey };
