import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getAllVenues, keyHeaders } from "@/lib/db";
import { getPoolAll } from "@/lib/pool";
import { Pool } from "./Pool";

export const dynamic = "force-dynamic";

/** How many answers each question has, across every place. */
async function answeredCounts(): Promise<Record<string, number>> {
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return {};
  try {
    const res = await fetch(`${url}/rest/v1/venue_answers?select=slug,q,n`, { headers: keyHeaders(anon), cache: "no-store" });
    if (!res.ok) return {};
    const rows = (await res.json()) as { slug: string; q: string; n: number }[];
    const perPlace = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.q}|${r.slug}`;
      perPlace.set(k, Math.max(perPlace.get(k) ?? 0, r.n));
    }
    const out: Record<string, number> = {};
    for (const [k, n] of perPlace) {
      const q = k.split("|")[0];
      out[q] = (out[q] ?? 0) + n;
    }
    return out;
  } catch {
    return {};
  }
}

export default async function QuestionsPage() {
  await requireAdmin();
  const [{ pool, table }, answered, venues] = await Promise.all([getPoolAll(true), answeredCounts(), getAllVenues()]);
  const names = Object.fromEntries(venues.map((v) => [v.slug, v.name]));
  const active = pool.filter((q) => q.active).length;
  return (
    <main className="screen pb-16">
      <header className="pt-6">
        <p className="eyebrow">Questions</p>
        <h1 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          What ROUND asks when someone rates a place.
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }} data-pool-count={active}>
          {active} live, {pool.length - active} retired. Every option maps to a trait the picker scores on.
        </p>
      </header>
      <Pool pool={pool} answered={answered} hasTable={table} names={names} />
    </main>
  );
}
