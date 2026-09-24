import "server-only";
import { updateTag } from "next/cache";
import { dbConfig, keyHeaders, serviceHeaders } from "./db";

/**
 * Studio switches. Today there's one: verified-only. When it's on (the
 * default), only places someone from ROUND has verified show anywhere in
 * the app: results, search, the shelf, the maps, the picker's catalog.
 * Everything else stays in the Studio, and the moment a place is verified
 * it's live. If the settings table isn't there yet, the default applies.
 */

export type Bounty = { open: boolean; cap: number; amount: number };
export type Settings = { verifiedOnly: boolean; bounty: Bounty };
/** The $2 offer: on, for the first 1,000 approved recommendations, until the Studio says otherwise. */
export const DEFAULT_BOUNTY: Bounty = { open: true, cap: 1000, amount: 2 };
/**
 * Until the settings table exists (schema.sql V15), everything shows, as it
 * always has. The SQL creates the row with the gate ON, so running it is
 * what flips the app to verified-only. `ROUND_VERIFIED_ONLY=1` does the same
 * without a database (the built-in list).
 */
export const DEFAULT_SETTINGS: Settings = { verifiedOnly: false, bounty: DEFAULT_BOUNTY };
export const SETTINGS_TAG = "settings";

export async function getSettings(): Promise<Settings> {
  const { url, anon, configured } = dbConfig();
  if (!configured) return { ...DEFAULT_SETTINGS, verifiedOnly: process.env.ROUND_VERIFIED_ONLY === "1" };
  try {
    const res = await fetch(`${url}/rest/v1/settings?select=key,value`, { headers: keyHeaders(anon!), next: { revalidate: 30, tags: [SETTINGS_TAG] } });
    if (!res.ok) return DEFAULT_SETTINGS;
    const rows = (await res.json()) as { key: string; value: unknown }[];
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (r.key === "verified_only" && typeof r.value === "boolean") out.verifiedOnly = r.value;
      if (r.key === "bounty" && r.value && typeof r.value === "object") {
        const b = r.value as Partial<Bounty>;
        out.bounty = { open: typeof b.open === "boolean" ? b.open : DEFAULT_BOUNTY.open, cap: Number.isFinite(Number(b.cap)) ? Number(b.cap) : DEFAULT_BOUNTY.cap, amount: Number.isFinite(Number(b.amount)) ? Number(b.amount) : DEFAULT_BOUNTY.amount };
      }
    }
    return out;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSetting(key: "verified_only" | "bounty", value: boolean | Bounty): Promise<void> {
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/settings?on_conflict=key`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Couldn't save the setting (${res.status}). Run the latest schema.sql first.`);
  updateTag(SETTINGS_TAG);
}
