import "server-only";

/** What the results page knows about the person's taste, from the round_taste cookie. */
export type Taste = { loves: string[]; nevers: string[]; tags: string[] };

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
  const out: Taste = { loves: [], nevers: [], tags: [] };
  for (const part of value.split(";")) {
    const [k, v] = part.split("=");
    const items = (v ?? "").split(",").filter(Boolean).slice(0, 10);
    if (k === "l") out.loves = items.filter((x) => SLUG.test(x));
    if (k === "n") out.nevers = items.filter((x) => SLUG.test(x));
    if (k === "t") out.tags = items.filter((x) => KEYW.test(x));
  }
  return out.loves.length || out.nevers.length || out.tags.length ? out : undefined;
}
