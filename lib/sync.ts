"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readState, type BeenEntry, type Remote, type RoundState, type SavedEntry } from "./store";

/**
 * Mirrors the local store into the account and back. Every call is
 * fire-and-forget from the UI's point of view: the screen already updated
 * from localStorage, and a failed network write never blocks anything.
 */

type SaveRow = {
  user_id: string;
  slug: string;
  state: "want" | "been";
  rating: BeenEntry["rating"] | null;
  source: SavedEntry["source"] | null;
  at: string;
  verdict?: BeenEntry["verdict"] | null;
  tags?: string[] | null;
  note?: string | null;
  rank?: number | null;
};

const warn = (what: string) => (e: unknown) => console.warn(`[sync] ${what}`, e);

/** Is this a "column doesn't exist yet" error (the database is a version behind)? */
const schemaBehind = (e: unknown) => /column|schema cache|Could not find/i.test(String((e as { message?: string })?.message ?? e));

/** Upsert with the V11 columns; if the database doesn't have them yet, again without. */
function upsertSaves(sb: SupabaseClient, rows: SaveRow[], what: string) {
  return sb
    .from("saves")
    .upsert(rows, { onConflict: "user_id,slug" })
    .then(({ error }) => {
      if (!error) return;
      if (!schemaBehind(error)) return warn(what)(error);
      const basic = rows.map(({ user_id, slug, state, rating, source, at }) => ({ user_id, slug, state, rating, source, at }));
      return sb.from("saves").upsert(basic, { onConflict: "user_id,slug" }).then(({ error: e2 }) => e2 && warn(what)(e2));
    });
}

function beenRow(userId: string, slug: string, entry: BeenEntry, rank: number | null = null): SaveRow {
  return { user_id: userId, slug, state: "been", rating: entry.rating ?? null, source: null, at: entry.at, verdict: entry.verdict ?? null, tags: entry.tags ?? null, note: entry.note ?? null, rank };
}

export function makeRemote(sb: SupabaseClient, userId: string | null): Remote {
  return {
    save(slug, entry) {
      if (!userId) return;
      if (entry) {
        const row: SaveRow = { user_id: userId, slug, state: "want", rating: null, source: entry.source ?? null, at: entry.at };
        sb.from("saves").upsert(row, { onConflict: "user_id,slug" }).then(({ error }) => error && warn("save")(error));
      } else {
        sb.from("saves").delete().match({ user_id: userId, slug }).then(({ error }) => error && warn("unsave")(error));
      }
    },
    been(slug, entry) {
      if (!userId) return;
      if (entry) void upsertSaves(sb, [beenRow(userId, slug, entry)], "been");
      else sb.from("saves").delete().match({ user_id: userId, slug }).then(({ error }) => error && warn("unbeen")(error));
    },
    ladder(order) {
      if (!userId || !order.length) return;
      // Ranks for everything on the ladder, in one write (rank = position, 1 = top).
      const state = readState();
      const rows = order.map((slug, i) => state.been[slug] && beenRow(userId, slug, state.been[slug], i + 1)).filter((r): r is SaveRow => !!r);
      if (rows.length) void upsertSaves(sb, rows, "ladder");
    },
    go(slug) {
      sb.from("go_taps").insert({ user_id: userId, slug }).then(({ error }) => error && warn("go")(error));
      // Friends may see where you are for a few hours (only if you let them; the database checks).
      // Check-ins ("friends can see which bar you're at") are switched off for now; the table stays for later.
    },
  };
}

/** Push everything on this phone into the account (used once, at sign-in). */
export async function pushAll(sb: SupabaseClient, userId: string, state: Pick<RoundState, "saved" | "been"> & { ladder?: string[] }) {
  const ladder = state.ladder ?? [];
  const rows: SaveRow[] = [
    ...Object.entries(state.saved).map(([slug, e]) => ({ user_id: userId, slug, state: "want" as const, rating: null, source: e.source ?? null, at: e.at })),
    ...Object.entries(state.been).map(([slug, e]) => beenRow(userId, slug, e, ladder.includes(slug) ? ladder.indexOf(slug) + 1 : null)),
  ];
  if (!rows.length) return;
  await upsertSaves(sb, rows, "pushAll");
}

/** Pull the account's history, in the store's shape. */
export async function pullAll(sb: SupabaseClient, userId: string): Promise<Pick<RoundState, "saved" | "been"> & { ladder: string[] }> {
  const full = await sb.from("saves").select("slug,state,rating,source,at,verdict,tags,note,rank").eq("user_id", userId);
  let rows: Omit<SaveRow, "user_id">[] = (full.data ?? []) as Omit<SaveRow, "user_id">[];
  if (full.error) {
    if (!schemaBehind(full.error)) throw full.error;
    const basic = await sb.from("saves").select("slug,state,rating,source,at").eq("user_id", userId);
    if (basic.error) throw basic.error;
    rows = (basic.data ?? []) as Omit<SaveRow, "user_id">[];
  }
  const saved: RoundState["saved"] = {};
  const been: RoundState["been"] = {};
  const ranked: { slug: string; rank: number }[] = [];
  for (const r of rows) {
    if (r.state === "been") {
      been[r.slug] = { at: r.at, rating: r.rating ?? undefined, verdict: r.verdict ?? undefined, tags: r.tags ?? undefined, note: r.note ?? undefined };
      if (typeof r.rank === "number") ranked.push({ slug: r.slug, rank: r.rank });
    } else saved[r.slug] = { at: r.at, source: r.source ?? undefined };
  }
  return { saved, been, ladder: ranked.sort((a, b) => a.rank - b.rank).map((r) => r.slug) };
}
