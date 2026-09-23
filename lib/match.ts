import type { Venue } from "./types";

/**
 * Finding a place by what people type: "bar primi", "McSorleys", "the
 * spaniard", "primi". Normalizes both sides, then scores by exact match,
 * whole-word containment, token overlap and letter-bigram similarity, so a
 * missing apostrophe or a dropped "The" never loses the match.
 */

export type VenueLite = Pick<Venue, "slug" | "name" | "neighborhood" | "kind" | "lat" | "lng"> & { tags?: string[] };

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DROP = new Set(["the", "bar", "nyc", "new", "york", "restaurant", "cafe", "lounge", "tavern", "pub", "room", "club", "co", "and"]);

function tokens(s: string): string[] {
  return normalizeName(s).split(" ").filter(Boolean);
}

/** The words that carry a name's identity: "The Spaniard" → ["spaniard"]. */
function coreTokens(s: string): string[] {
  const t = tokens(s);
  const core = t.filter((w) => !DROP.has(w));
  return core.length ? core : t;
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = normalizeName(s).replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return (2 * hit) / (a.size + b.size);
}

/** 0..1 how well `query` names this venue. */
export function nameScore(query: string, name: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qc = coreTokens(query).join(" ");
  const nc = coreTokens(name).join(" ");
  if (qc && qc === nc) return 0.97;
  const qt = coreTokens(query);
  const nt = coreTokens(name);
  // Every query word is a whole word of the name ("primi" ⊂ "bar primi", "death co" ⊂ "death and co").
  if (qt.length && qt.every((w) => nt.includes(w))) return 0.9 - 0.04 * Math.max(0, nt.length - qt.length);
  // Every query word starts a word of the name ("mcsor" → "mcsorleys").
  if (qt.length && qt.every((w) => w.length >= 3 && nt.some((x) => x.startsWith(w)))) return 0.8 - 0.04 * Math.max(0, nt.length - qt.length);
  const d = dice(bigrams(qc || q), bigrams(nc || n));
  return d >= 0.5 ? d * 0.9 : 0;
}

/** Best matches for a typed query, strongest first. Empty when nothing is close. */
export function matchVenues<T extends { name: string }>(query: string, venues: T[], limit = 8): { venue: T; score: number }[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  return venues
    .map((venue) => ({ venue, score: nameScore(q, venue.name) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.venue.name.length - b.venue.name.length)
    .slice(0, limit);
}

/** Place names that are also everyday words; they need a lead-in to count. */
const ORDINARY = new Set(["local", "diner", "standings", "phoenix", "banshee", "bungalow", "cowgirl", "smalls", "chambers", "sauced", "faux", "monsieur", "palace", "twins", "snack", "wiggle", "lantern", "eavesdrop", "penny", "donna", "layla", "julius", "hideaway", "primos", "ramona", "bernies", "commodore", "wayland", "niagara", "fairfax", "walker", "walkers", "odeon", "westlight", "broken", "pencil", "achilles", "tigre", "freemans", "wildair", "loreley", "purple", "lullaby", "milady", "miladys", "toad", "botanica", "milano", "milanos", "broome", "onieals", "jimmy", "brandy", "nancy", "puffy", "puffys", "mudville", "terroir", "django", "lobby", "jungle", "trailer", "frying", "standard", "somewhere", "brass", "rebar", "quijote", "shukette", "pastis", "mariscos", "delmano", "fresh", "kills", "deux", "chats", "lucky", "petes", "candy", "mazie", "babys", "night", "berry", "metropolitan", "quarter", "bembe", "desert", "anselm", "fish", "cheeks", "birds", "feather", "laser", "wolf", "kelloggs", "torst", "goldies", "keg", "black", "rabbit", "sunshine", "laundromat", "pinball", "diamond", "lise", "vito", "capri", "brew", "pinguino", "tante", "wenwen", "karczma", "lucys", "veselka", "claud", "superiority", "burger", "lucien", "schmuck", "superbueno", "monas", "grafton", "maiden", "lane", "lil", "frankies", "banshee", "pearl", "south", "beyond", "pale", "mothers", "ruin", "compagnie", "vins", "surnaturels", "vig", "balthazar", "raouls", "rubirosa", "emilios", "ballato", "esquina", "katana", "kitten", "angels", "share", "guzzle", "jardim", "dive", "blind", "tiger", "wxou", "radio", "art", "corner", "bistro", "marie", "maries", "crisis", "cubbyhole", "stonewall", "cellar", "dog", "wogies", "down", "hatch", "minetta", "buvette", "boucherie", "angie", "emmetts", "grove", "double", "chicken", "please", "little", "copper", "oak", "parkside", "welcome", "johnsons", "sadies", "ward", "ten", "bells", "hair", "home", "sweet", "wus", "wonton", "king", "scarrs", "bacaro", "employees", "only", "happiest", "hour", "wilfie", "nell", "fiddlesticks", "carota", "artusi", "jeffreys", "grocery", "antons", "death", "amor", "amargo", "mister", "paradise", "dont", "tell", "joyface", "primi", "rays", "attaboy", "flower", "shop", "clandestino", "fongs", "goto", "back", "room", "cervos", "kikis", "fanelli", "ear", "inn", "temple", "ship", "vicious", "spring", "thai", "smith", "mills", "weather", "frenchette", "tinys", "upstairs", "bathtub", "gin", "gallow", "green", "porchlight", "tippler", "cookshop", "union", "pool", "maison", "premiere", "skinny", "dennis", "blondeau", "radegast", "hall", "biergarten", "clems", "four", "horsemen", "llama", "lilia", "oxomoco"]);

// Words that name a place only as part of a longer name: neighborhoods, streets, the nouns every third bar uses.
const GENERIC = new Set(["village", "house", "hotel", "garden", "street", "kitchen", "brooklyn", "place", "corner", "avenue", "north", "south", "little", "grand", "royal", "social", "public", "dinner", "drinks", "night", "spirits", "wines", "beers", "burger", "pizza", "taqueria", "grill", "market", "table", "eleven", "first", "second", "third", "williamsburg", "greenpoint", "chelsea", "tribeca", "soho", "nolita", "manhattan", "bleecker", "bowery", "bedford", "broadway", "rooftop", "tavern", "lounge", "cafe", "club", "saloon", "cantina", "bistro", "brasserie", "oyster", "wine", "cocktail", "beer", "coffee", "restaurant"]);

const LEAD_IN = /(?:^|\b(?:at|near|around|by|like|to|from|of|in|outside|inside|next to|close to)\s+)$/;

/**
 * A place named inside a sentence: "six of us near bar primi around 9".
 * Multi-word names match anywhere; single-word names only after a lead-in
 * ("at Von", "near Local") or when the sentence is basically just the name,
 * so "local dive" doesn't become the bar called Local.
 */
export function findVenueInText<T extends { name: string }>(text: string, venues: T[]): { venue: T; near: boolean } | null {
  const t = ` ${normalizeName(text)} `;
  let best: { venue: T; len: number; at: number } | null = null;
  for (const venue of venues) {
    const variants = new Set<string>([normalizeName(venue.name), coreTokens(venue.name).join(" ")]);
    for (const v of variants) {
      if (v.length < 3) continue;
      const idx = t.indexOf(` ${v} `);
      if (idx < 0) continue;
      const single = !v.includes(" ");
      if (single) {
        const before = t.slice(0, idx + 1);
        const whole = t.trim() === v;
        if (!whole && !LEAD_IN.test(before) && v.length < 7) continue;
      }
      if (!best || v.length > best.len) best = { venue, len: v.length, at: idx };
    }
  }
  if (!best) {
    // No full name in the sentence. Try a signature word: a distinctive word
    // that belongs to exactly one place ("mcsorleys", "spaniard", "attaboy").
    const owners = new Map<string, T[]>();
    for (const venue of venues) for (const w of new Set(coreTokens(venue.name))) {
      if (w.length < 5 || GENERIC.has(w)) continue;
      owners.set(w, [...(owners.get(w) ?? []), venue]);
    }
    for (const [w, list] of owners) {
      if (list.length !== 1) continue;
      const idx = t.indexOf(` ${w} `);
      if (idx < 0) continue;
      // Short or ordinary words only count after "at", "near", "like"…
      if ((w.length < 7 || ORDINARY.has(w)) && !LEAD_IN.test(t.slice(0, idx + 1)) && t.trim() !== w) continue;
      if (!best || w.length > best.len) best = { venue: list[0], len: w.length, at: idx };
    }
  }
  if (!best) return null;
  const before = t.slice(0, best.at + 1);
  const near = /\b(near|around|by|close to|next to|walking distance (of|from)|i'?m at|we'?re at|at)\s+$/.test(before) && !/\blike\s+$/.test(before);
  return { venue: best.venue, near };
}
