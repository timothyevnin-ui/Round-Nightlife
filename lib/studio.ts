import "server-only";
import { dbConfig, serviceHeaders } from "./db";

/**
 * Reads for ROUND Studio. All with the secret key, none cached, none reachable
 * from the app. Every function returns something sensible when the database
 * isn't connected or a table hasn't been created yet, and says so.
 */

export type Profile = { id: string; name: string; phone: string | null; birthday: string | null; created_at: string };
export type GoTap = { id: number; user_id: string | null; slug: string; at: string };
export type SaveRow = { user_id: string; slug: string; state: "want" | "been"; rating: string | null; at: string };

async function rows<T>(path: string): Promise<{ rows: T[]; problem?: string }> {
  if (!dbConfig().writable) return { rows: [], problem: "Connect Supabase (SUPABASE.md) to see this." };
  try {
    const { url, headers } = serviceHeaders();
    const res = await fetch(`${url}/rest/v1/${path}`, { headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 || /relation .* does not exist|Could not find the table/i.test(text)) return { rows: [], problem: "That table doesn't exist yet. Run supabase/schema.sql again (SUPABASE.md, step 6b)." };
      return { rows: [], problem: `Database said ${res.status}.` };
    }
    return { rows: (await res.json()) as T[] };
  } catch (e) {
    return { rows: [], problem: e instanceof Error ? e.message : "Couldn't reach the database." };
  }
}

export const listProfiles = (limit = 500) => rows<Profile>(`profiles?select=id,name,phone,birthday,created_at&order=created_at.desc&limit=${limit}`);
export type ReferralRow = { id: string; ref_code: string | null; referred_by: string | null; referred_at: string | null };
/** Referrals (V28): everyone's code and who sent them. Empty (with a note) until the V28 schema is in. */
export const listReferrals = (limit = 2000) => rows<ReferralRow>(`profiles?select=id,ref_code,referred_by,referred_at&limit=${limit}`);
export const listGoTaps = (sinceDays = 30, limit = 2000) => rows<GoTap>(`go_taps?select=*&at=gte.${encodeURIComponent(new Date(Date.now() - sinceDays * 864e5).toISOString())}&order=at.desc&limit=${limit}`);
export const listSaves = (limit = 2000) => rows<SaveRow>(`saves?select=user_id,slug,state,rating,at&order=at.desc&limit=${limit}`);

/** "(914) ···-5942": enough to recognize, not enough to dial. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  const last = d.slice(-4);
  const area = d.length >= 10 ? d.slice(-10, -7) : "";
  return area ? `(${area}) ···-${last}` : `···${last}`;
}

export function countBy<T>(list: T[], key: (t: T) => string | null | undefined, n = 10): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = key(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
