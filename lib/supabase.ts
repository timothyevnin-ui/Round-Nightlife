"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The browser-side Supabase client. Used only for accounts and the person's
 * own data (saves, ratings, GO taps); row-level security keeps everyone in
 * their own lane. Venue data still comes through lib/db.ts on the server.
 *
 * Returns null when the app is running without a database, so every caller
 * degrades to local-only behavior.
 */

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === "undefined") {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "round:auth" },
  });
  return client;
}

export function accountsEnabled() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}
