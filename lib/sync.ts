"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BeenEntry, Remote, RoundState, SavedEntry } from "./store";

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
};

const warn = (what: string) => (e: unknown) => console.warn(`[sync] ${what}`, e);

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
      if (entry) {
        const row: SaveRow = { user_id: userId, slug, state: "been", rating: entry.rating ?? null, source: null, at: entry.at };
        sb.from("saves").upsert(row, { onConflict: "user_id,slug" }).then(({ error }) => error && warn("been")(error));
      } else {
        sb.from("saves").delete().match({ user_id: userId, slug }).then(({ error }) => error && warn("unbeen")(error));
      }
    },
    go(slug) {
      sb.from("go_taps").insert({ user_id: userId, slug }).then(({ error }) => error && warn("go")(error));
    },
  };
}

/** Push everything on this phone into the account (used once, at sign-in). */
export async function pushAll(sb: SupabaseClient, userId: string, state: Pick<RoundState, "saved" | "been">) {
  const rows: SaveRow[] = [
    ...Object.entries(state.saved).map(([slug, e]) => ({ user_id: userId, slug, state: "want" as const, rating: null, source: e.source ?? null, at: e.at })),
    ...Object.entries(state.been).map(([slug, e]) => ({ user_id: userId, slug, state: "been" as const, rating: e.rating ?? null, source: null, at: e.at })),
  ];
  if (!rows.length) return;
  const { error } = await sb.from("saves").upsert(rows, { onConflict: "user_id,slug" });
  if (error) throw error;
}

/** Pull the account's history, in the store's shape. */
export async function pullAll(sb: SupabaseClient, userId: string): Promise<Pick<RoundState, "saved" | "been">> {
  const { data, error } = await sb.from("saves").select("slug,state,rating,source,at").eq("user_id", userId);
  if (error) throw error;
  const saved: RoundState["saved"] = {};
  const been: RoundState["been"] = {};
  for (const r of (data ?? []) as Omit<SaveRow, "user_id">[]) {
    if (r.state === "been") been[r.slug] = { at: r.at, rating: r.rating ?? undefined };
    else saved[r.slug] = { at: r.at, source: r.source ?? undefined };
  }
  return { saved, been };
}
