import "server-only";

/** What the results page knows about the person's taste, from the round_taste cookie. */
export type Taste = { loves: string[]; nevers: string[]; tags: string[]; /** [card id, answer label] — how they usually answer the quick ones. */ usual: [string, string][] };

const SLUG = /^[a-z0-9-]{1,60}$/;
const KEYW = /^[a-zA-Z]{1,24}$/;

export function parseTaste(raw: string | undefined | null): Taste | undefined {
  if (!raw) return undefined;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  const out: Taste = { loves: [], nevers: [], tags: [], usual: [] };
  for (const part of value.split(";")) {
    const [k, v] = part.split("=");
    const items = (v ?? "").split(",").filter(Boolean).slice(0, 10);
    if (k === "l") out.loves = items.filter((x) => SLUG.test(x));
    if (k === "n") out.nevers = items.filter((x) => SLUG.test(x));
    if (k === "t") out.tags = items.filter((x) => KEYW.test(x));
    if (k === "u")
      out.usual = items
        .map((x) => x.split(":"))
        .filter((p): p is [string, string] => p.length === 2 && /^[a-z0-9-]{1,24}$/.test(p[0]) && /^[a-zA-Z0-9_-]{1,24}$/.test(p[1]))
        .map(([id, label]) => [id, label.replace(/_/g, " ")]);
  }
  return out.loves.length || out.nevers.length || out.tags.length || out.usual.length ? out : undefined;
}

/** The first name from the round_name cookie, or nothing. */
export function parseName(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  v = v.trim().slice(0, 24);
  return /^[\p{L}\p{M}'’-]{1,24}$/u.test(v) ? v : undefined;
}

/** The favorite-bar slug from the round_fav cookie, or nothing. */
export function parseFav(raw: string | undefined | null): string | undefined {
  const v = (raw ?? "").trim();
  return SLUG.test(v) ? v : undefined;
}
