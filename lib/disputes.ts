import "server-only";
import { serviceHeaders, missingColumn } from "./db";

/**
 * "Disagree with our take." A reader on the Spots tab says what ROUND got
 * wrong about a place, in their own words. Only the server touches this
 * table (secret key). Studio confirms or declines each one; a confirmed one
 * is read into the place by the AI, so the algorithm learns it.
 */

export type DisputeStatus = "new" | "confirmed" | "declined";

export type Dispute = {
  id: string;
  slug: string;
  text: string;
  /** What it's about, if they picked one: food, crowd, price, noise, line, hours. */
  about?: string;
  fromName?: string;
  userId?: string;
  status: DisputeStatus;
  /** What the AI learned from it, once confirmed. */
  learned?: string;
  resolvedAt?: string;
  createdAt: string;
};

type Row = {
  id: string;
  slug: string;
  text: string;
  about: string | null;
  from_name: string | null;
  user_id: string | null;
  status: string;
  learned: string | null;
  resolved_at: string | null;
  created_at: string;
};

const TABLE_MISSING = "The disputes table doesn't exist yet. Run supabase/schema.sql again (SUPABASE.md, step 12).";

function explain(status: number, text: string) {
  if (status === 404 || /relation .* does not exist|Could not find the table/i.test(text)) return TABLE_MISSING;
  const col = missingColumn(text);
  if (col) return `The disputes table is missing the "${col}" column. Run supabase/schema.sql again.`;
  return `Database said ${status}: ${text.slice(0, 200)}`;
}

function rowToDispute(r: Row): Dispute {
  return {
    id: r.id,
    slug: r.slug,
    text: r.text,
    about: r.about ?? undefined,
    fromName: r.from_name ?? undefined,
    userId: r.user_id ?? undefined,
    status: r.status === "confirmed" || r.status === "declined" ? r.status : "new",
    learned: r.learned ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}

export async function insertDispute(d: { slug: string; text: string; about?: string; fromName?: string; userId?: string }): Promise<string> {
  const { url, headers } = serviceHeaders();
  const row = { slug: d.slug, text: d.text, about: d.about ?? null, from_name: d.fromName ?? null, user_id: d.userId ?? null };
  const res = await fetch(`${url}/rest/v1/disputes?select=id`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(row), cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  const json = (await res.json()) as { id: string }[];
  return json[0]?.id ?? "";
}

export async function listDisputes(status?: DisputeStatus, limit = 200): Promise<Dispute[]> {
  const { url, headers } = serviceHeaders();
  const filter = status ? `&status=eq.${status}` : "";
  const res = await fetch(`${url}/rest/v1/disputes?select=*${filter}&order=created_at.desc&limit=${limit}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  return ((await res.json()) as Row[]).map(rowToDispute);
}

/** Everything one person has said, newest first (for their YOU page). */
export async function listDisputesBy(userId: string, limit = 50): Promise<Dispute[]> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return [];
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/disputes?select=*&user_id=eq.${userId}&order=created_at.desc&limit=${limit}`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as Row[]).map(rowToDispute);
}

export async function getDispute(id: string): Promise<Dispute | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/disputes?select=*&id=eq.${id}&limit=1`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  const rows = (await res.json()) as Row[];
  return rows[0] ? rowToDispute(rows[0]) : null;
}

export async function setDisputeStatus(id: string, status: DisputeStatus, learned?: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Bad id.");
  const { url, headers } = serviceHeaders();
  const body = { status, learned: learned ?? null, resolved_at: status === "new" ? null : new Date().toISOString() };
  const res = await fetch(`${url}/rest/v1/disputes?id=eq.${id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
}

/** How many a person has sent today (a soft cap against spam). */
export async function countDisputesToday(userId: string | undefined, fromName: string | undefined): Promise<number> {
  const { url, headers } = serviceHeaders();
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const who = userId ? `&user_id=eq.${userId}` : fromName ? `&from_name=eq.${encodeURIComponent(fromName)}` : "";
  if (!who) return 0;
  const res = await fetch(`${url}/rest/v1/disputes?select=id&created_at=gte.${since}${who}&limit=50`, { headers, cache: "no-store" });
  if (!res.ok) return 0;
  return ((await res.json()) as unknown[]).length;
}
