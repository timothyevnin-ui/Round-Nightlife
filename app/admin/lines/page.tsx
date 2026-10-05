import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getAllVenues, serviceHeaders } from "@/lib/db";
import { Lines, type StudioLine } from "./Lines";

export const dynamic = "force-dynamic";

/** Every line anyone left, hidden ones too (service role; first names only on the page). */
async function listLines(): Promise<{ lines: StudioLine[]; problem?: string }> {
  const { writable } = dbConfig();
  if (!writable) return { lines: [], problem: "Connect Supabase (SUPABASE.md) to see what people say." };
  try {
    const { url, headers } = serviceHeaders();
    const res = await fetch(`${url}/rest/v1/saves?select=user_id,slug,note,at,hidden,verdict&state=eq.been&note=not.is.null&order=at.desc&limit=300`, { headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      if (/hidden/.test(text)) return { lines: [], problem: "The saves table is missing the hidden column. Run the latest schema.sql." };
      return { lines: [], problem: `Database said ${res.status}.` };
    }
    const rows = ((await res.json()) as { user_id: string; slug: string; note: string | null; at: string; hidden: boolean | null; verdict: string | null }[]).filter((r) => r.note && r.note.trim());
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const names = new Map<string, string>();
    if (ids.length) {
      const pr = await fetch(`${url}/rest/v1/profiles?select=id,name&id=in.(${ids.map((i) => `"${i}"`).join(",")})`, { headers, cache: "no-store" });
      if (pr.ok) for (const p of (await pr.json()) as { id: string; name: string | null }[]) names.set(p.id, (p.name ?? "Someone").split(" ")[0] || "Someone");
    }
    return { lines: rows.map((r) => ({ userId: r.user_id, slug: r.slug, name: names.get(r.user_id) ?? "Someone", note: r.note!, at: r.at, hidden: !!r.hidden, verdict: r.verdict })) };
  } catch (e) {
    return { lines: [], problem: e instanceof Error ? e.message : "Couldn't load." };
  }
}

export default async function LinesPage() {
  await requireAdmin();
  const [{ lines, problem }, venues] = await Promise.all([listLines(), getAllVenues()]);
  const names = Object.fromEntries(venues.map((v) => [v.slug, v.name]));
  return (
    <main className="screen pb-16">
      <header className="pt-6">
        <p className="eyebrow">People say</p>
        <h1 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          {problem ? "The lines." : lines.length ? `${lines.length} line${lines.length === 1 ? "" : "s"}.` : "Nothing yet."}
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: problem ? "var(--tomato-deep)" : "var(--ink-55)" }}>
          {problem ?? "Every one-liner anyone left under a place. Hide one and it's off the page; the rating stays."}
        </p>
      </header>
      <Lines lines={lines} names={names} />
    </main>
  );
}
