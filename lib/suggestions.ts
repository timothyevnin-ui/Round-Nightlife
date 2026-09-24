import { ATTR_KEYS } from "./attrs";
import { asksToText, type Ask } from "./askQuestions";
import { serviceHeaders, missingColumn } from "./db";
import { isNeighborhoodId } from "./neighborhoods";
import { clamp01 } from "./normalize";
import type { Attrs, Venue } from "./types";

/**
 * Recommendations from the public ("Know a spot we don't?"). Anyone can send
 * one; only the back office reads them. Everything here runs on the server
 * with the secret key — there's no public policy on the table at all.
 */

export type SuggestionStatus = "new" | "added" | "dismissed";

/** What the quick questions on /recommend produce. All optional. */
export type SuggestionAnswers = {
  attrs?: Partial<Attrs>;
  price?: 1 | 2 | 3 | 4;
  easyIn?: number;
  groupBig?: number;
  dateFit?: number;
  capacity?: "tiny" | "small" | "medium" | "large";
  /** The raw button labels, for the inbox ("Loud · Seats · No line"). Older flow. */
  said?: string[];
  /** The typed answers (V20): what they said, question by question. This is what the AI reads. */
  words?: Partial<Record<Ask["key"], string>>;
};

export type Suggestion = {
  id: string;
  name: string;
  kind: "bar" | "restaurant";
  neighborhood?: string;
  address?: string;
  why?: string;
  answers: SuggestionAnswers;
  fromName?: string;
  fromContact?: string;
  userId?: string;
  /** Their Venmo handle, for the $2 (V20). Only the Studio ever sees it. */
  venmo?: string;
  /** When the $2 went out (V20). */
  paidAt?: string;
  status: SuggestionStatus;
  venueSlug?: string;
  createdAt: string;
};

export type SuggestionInput = Omit<Suggestion, "id" | "status" | "venueSlug" | "createdAt" | "paidAt">;

type Row = {
  id: string;
  name: string;
  kind: string;
  neighborhood: string | null;
  address: string | null;
  why: string | null;
  answers: SuggestionAnswers | null;
  from_name: string | null;
  from_contact: string | null;
  user_id: string | null;
  venmo?: string | null;
  paid_at?: string | null;
  status: string;
  venue_slug: string | null;
  created_at: string;
};

function rowToSuggestion(r: Row): Suggestion {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === "restaurant" ? "restaurant" : "bar",
    neighborhood: r.neighborhood ?? undefined,
    address: r.address ?? undefined,
    why: r.why ?? undefined,
    answers: r.answers && typeof r.answers === "object" ? r.answers : {},
    fromName: r.from_name ?? undefined,
    fromContact: r.from_contact ?? undefined,
    userId: r.user_id ?? undefined,
    venmo: r.venmo ?? undefined,
    paidAt: r.paid_at ?? undefined,
    status: r.status === "added" || r.status === "dismissed" ? r.status : "new",
    venueSlug: r.venue_slug ?? undefined,
    createdAt: r.created_at,
  };
}

const TABLE_MISSING = "The suggestions table doesn't exist yet. Run supabase/schema.sql again (SUPABASE.md, step 6b).";

function explain(status: number, text: string) {
  if (status === 404 || /relation .* does not exist|Could not find the table/i.test(text)) return TABLE_MISSING;
  const col = missingColumn(text);
  if (col) return `The suggestions table is missing the "${col}" column. Run supabase/schema.sql again.`;
  return `Database said ${status}: ${text.slice(0, 200)}`;
}

export async function insertSuggestion(s: SuggestionInput): Promise<string> {
  const { url, headers } = serviceHeaders();
  const row: Record<string, unknown> = {
    name: s.name,
    kind: s.kind,
    neighborhood: s.neighborhood ?? null,
    address: s.address ?? null,
    why: s.why ?? null,
    answers: s.answers ?? {},
    from_name: s.fromName ?? null,
    from_contact: s.fromContact ?? null,
    user_id: s.userId ?? null,
    venmo: s.venmo ?? null,
  };
  // A database a version behind (no venmo column yet) still takes the row; the column is named in the log.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${url}/rest/v1/suggestions?select=id`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { id: string }[];
      return json[0]?.id ?? "";
    }
    const text = await res.text();
    const missing = missingColumn(text);
    if (missing && missing in row) {
      console.warn(`[suggestions] suggestions.${missing} doesn't exist yet; saving without it. Run supabase/schema.sql again.`);
      delete row[missing];
      continue;
    }
    throw new Error(explain(res.status, text));
  }
  throw new Error("Couldn't save the recommendation: the database is several versions behind.");
}

/** How many recommendations ROUND has approved (added to the list): the $2 counter. */
export async function countApproved(): Promise<number> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/suggestions?select=id&status=eq.added`, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" }, cache: "no-store" });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") ?? "";
  const m = range.match(/\/(\d+)$/);
  if (m) return Number(m[1]);
  return ((await res.json()) as unknown[]).length;
}

/** Approved, with a Venmo, not yet paid: who's owed. */
export async function listOwed(): Promise<Suggestion[]> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/suggestions?select=*&status=eq.added&venmo=not.is.null&paid_at=is.null&order=created_at.asc&limit=500`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as Row[]).map(rowToSuggestion);
}

export async function markSuggestionPaid(id: string, paid: boolean): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Bad id.");
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/suggestions?id=eq.${id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ paid_at: paid ? new Date().toISOString() : null }), cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
}

export async function listSuggestions(status?: SuggestionStatus): Promise<Suggestion[]> {
  const { url, headers } = serviceHeaders();
  const filter = status ? `&status=eq.${status}` : "";
  const res = await fetch(`${url}/rest/v1/suggestions?select=*${filter}&order=created_at.desc&limit=200`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  return ((await res.json()) as Row[]).map(rowToSuggestion);
}

export async function getSuggestion(id: string): Promise<Suggestion | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/suggestions?select=*&id=eq.${id}&limit=1`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
  const rows = (await res.json()) as Row[];
  return rows[0] ? rowToSuggestion(rows[0]) : null;
}

export async function setSuggestionStatus(id: string, status: SuggestionStatus, venueSlug?: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Bad id.");
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/suggestions?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ status, venue_slug: venueSlug ?? null }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(explain(res.status, await res.text()));
}

/* ───────────────────────── suggestion → venue draft ───────────────────────── */

/** Turn what someone told us into a head start for the back-office form. */
export function suggestionToDraft(s: Suggestion): Partial<Venue> & { notes: string } {
  const attrs: Partial<Attrs> = {};
  for (const k of ATTR_KEYS) {
    const v = s.answers.attrs?.[k];
    if (typeof v === "number") attrs[k] = clamp01(v, 0);
  }
  const words = asksToText(s.answers.words);
  const lines = [
    `— Recommended by ${s.fromName?.trim() || "someone"}${s.fromContact ? ` (${s.fromContact.trim()})` : ""} on ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${s.venmo ? " · $2 offer" : ""}.`,
    words ? `In their words:\n${words}` : s.why?.trim() ? `They said: "${s.why.trim()}"` : "",
    s.answers.said?.length ? `Their answers: ${s.answers.said.join(" · ")}.` : "",
  ].filter(Boolean);
  const big = s.answers.groupBig;
  const date = s.answers.dateFit;
  return {
    name: s.name,
    kind: s.kind,
    neighborhood: isNeighborhoodId(s.neighborhood) ? s.neighborhood : undefined,
    address: s.address ?? "",
    attrs: attrs as Attrs,
    price: s.answers.price,
    easyIn: s.answers.easyIn,
    groupFit: typeof big === "number" ? { two: 0.6, small: 0.7, mid: big >= 0.5 ? 0.7 : 0.4, big } : undefined,
    dateFit: typeof date === "number" ? { first: date, early: date, longterm: Math.max(0.5, date) } : undefined,
    notes: lines.join("\n"),
    verified: false,
  };
}
