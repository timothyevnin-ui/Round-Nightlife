"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/** What you've sent in (V34): how many, how many made the list, how many were paid. Null until the database knows the function. */
export type Contributions = { sent: number; added: number; paid: number };

export async function myContributions(sb: SupabaseClient): Promise<Contributions | null> {
  const { data, error } = await sb.rpc("my_contributions");
  if (error || !data || typeof data !== "object") return null;
  const d = data as Partial<Contributions>;
  return { sent: Number(d.sent ?? 0), added: Number(d.added ?? 0), paid: Number(d.paid ?? 0) };
}
