import "server-only";
import { dbConfig, keyHeaders } from "./db";
import type { Crowd } from "@/components/Score";

/**
 * The crowd's numbers per place, from the venue_scores view (counts only, no
 * user ids). Empty when the database isn't set up; never throws.
 */
export async function crowdScores(slugs?: string[]): Promise<Record<string, Crowd>> {
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return {};
  try {
    const filter = slugs?.length ? `&slug=in.(${slugs.map((s) => `"${s}"`).join(",")})` : "";
    const res = await fetch(`${url}/rest/v1/venue_scores?select=slug,n,back,again${filter}`, { headers: keyHeaders(anon), next: { revalidate: 60 } });
    if (!res.ok) return {};
    const rows = (await res.json()) as { slug: string; n: number; back: number; again: number }[];
    return Object.fromEntries(rows.map((r) => [r.slug, { n: r.n, back: r.back, again: r.again }]));
  } catch {
    return {};
  }
}
