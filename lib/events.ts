import { dbConfig, serviceHeaders, missingColumn } from "./db";

/**
 * The activity log. Every write goes through the server with the secret key;
 * nothing here is readable from the app. Failures never surface to users:
 * logging is best-effort and the app works the same without a database.
 */

export type EventKind = "sayit" | "search" | "results" | "view" | "save" | "near" | "go";

export type EventRow = {
  id: number;
  kind: EventKind;
  slug: string | null;
  q: string | null;
  data: Record<string, unknown>;
  user_id: string | null;
  at: string;
};

const KINDS: EventKind[] = ["sayit", "search", "results", "view", "save", "near", "go"];

export function isEventKind(k: unknown): k is EventKind {
  return typeof k === "string" && (KINDS as string[]).includes(k);
}

const cut = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : null);

/** Insert one event. Never throws; returns whether it landed. */
export async function logEvent(e: { kind: EventKind; slug?: string | null; q?: string | null; data?: Record<string, unknown>; userId?: string | null }): Promise<boolean> {
  if (!dbConfig().writable) return false;
  try {
    const { url, headers } = serviceHeaders();
    const data = e.data && typeof e.data === "object" ? JSON.parse(JSON.stringify(e.data).slice(0, 4000)) : {};
    const res = await fetch(`${url}/rest/v1/events`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ kind: e.kind, slug: cut(e.slug, 80), q: cut(e.q, 300), data, user_id: e.userId ?? null }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      if (!/relation .* does not exist|Could not find the table/i.test(text)) console.warn("[events] insert failed", res.status, text.slice(0, 160));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[events] insert error", err);
    return false;
  }
}

const TABLE_MISSING = "The events table doesn't exist yet. Run supabase/schema.sql again (SUPABASE.md, step 6b).";

function explain(status: number, text: string) {
  if (status === 404 || /relation .* does not exist|Could not find the table/i.test(text)) return TABLE_MISSING;
  const col = missingColumn(text);
  if (col) return `The events table is missing the "${col}" column. Run supabase/schema.sql again.`;
  return `Database said ${status}: ${text.slice(0, 200)}`;
}

/** Recent events, newest first. Studio only. */
export async function listEvents(opts: { kind?: EventKind; limit?: number; sinceDays?: number } = {}): Promise<EventRow[]> {
  const { url, headers } = serviceHeaders();
  const params = new URLSearchParams({ select: "*", order: "at.desc", limit: String(Math.min(1000, opts.limit ?? 200)) });
  if (opts.kind) params.set("kind", `eq.${opts.kind}`);
  if (opts.sinceDays) params.set("at", `gte.${new Date(Date.now() - opts.sinceDays * 864e5).toISOString()}`);
  const res = await fetch(`${url}/rest/v1/events?${params.toString()}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  return (await res.json()) as EventRow[];
}

/** Counts by slug for one kind over a window (top N). */
export function topBySlug(events: EventRow[], kind: EventKind, n = 10): { slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) if (e.kind === kind && e.slug) counts.set(e.slug, (counts.get(e.slug) ?? 0) + 1);
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Counts by free text for one kind (lowercased, trimmed). */
export function topByText(events: EventRow[], kind: EventKind, n = 10): { q: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== kind || !e.q) continue;
    const k = e.q.trim().toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([q, count]) => ({ q, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
