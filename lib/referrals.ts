"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Referrals (V28). Everyone has a six-letter code; a link carries it
 * (roundnyc.com/you?ref=TIM4K2) and the code rides along through sign-up on
 * this phone, so the friend never types it. Ten sign-ups on your code, $5.
 */

export const GOAL = 10;
export const REWARD = "$5";
const KEY = "round_ref";

/** A code as people type it: letters and digits, upper-case, six of them. */
export function cleanCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/** The link that carries your code. */
export function referralLink(code: string): string {
  const base = typeof window !== "undefined" && /roundnyc\.com|vercel\.app/.test(window.location.host) ? window.location.origin : "https://roundnyc.com";
  return `${base}/you?ref=${code}`;
}

/** Any page with ?ref= in its address: the code is kept on this phone until sign-up uses it. Returns the code seen, if any. */
export function captureRef(): string | null {
  try {
    const code = cleanCode(new URLSearchParams(window.location.search).get("ref") ?? "");
    if (code.length === 6) {
      localStorage.setItem(KEY, code);
      return code;
    }
  } catch {
    /* private mode: the code lives only in the address, which sign-up also reads */
  }
  return null;
}

/** The code waiting on this phone, from a link or the address bar. */
export function pendingRef(): string {
  try {
    const fromUrl = cleanCode(new URLSearchParams(window.location.search).get("ref") ?? "");
    if (fromUrl.length === 6) return fromUrl;
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Whose code: a first name, for the pitch. Null when nobody has that code; "unavailable" when the database is behind. */
export async function whoReferred(sb: SupabaseClient, code: string): Promise<string | null | "unavailable"> {
  const { data, error } = await sb.rpc("who_referred", { code: cleanCode(code) });
  if (error) return "unavailable";
  return data ? String(data) : null;
}

export type RedeemResult = { ok: true; name: string; id: string | null } | { ok: false; reason: "no-such-code" | "own-code" | "already-used" | "not-new" | "unavailable" };

/** A new account enters a code. */
export async function redeemReferral(sb: SupabaseClient, code: string): Promise<RedeemResult> {
  const { data, error } = await sb.rpc("redeem_referral", { code: cleanCode(code) });
  if (!error) {
    clearRef();
    const d = (data ?? {}) as { id?: string; name?: string };
    return { ok: true, name: String(d.name ?? "A friend"), id: d.id ?? null };
  }
  const m = error.message ?? "";
  if (/no such code/i.test(m)) return { ok: false, reason: "no-such-code" };
  if (/own code/i.test(m)) return { ok: false, reason: "own-code" };
  if (/already used/i.test(m)) return { ok: false, reason: "already-used" };
  if (/not new/i.test(m)) return { ok: false, reason: "not-new" };
  return { ok: false, reason: "unavailable" };
}

export function redeemWords(r: RedeemResult): string {
  if (r.ok) return `${r.name} gets one closer to ${REWARD}.`;
  switch (r.reason) {
    case "no-such-code":
      return "That code doesn't match anyone. Check it and try again, or skip it.";
    case "own-code":
      return "That's your own code.";
    case "already-used":
      return "This account already used a code.";
    case "not-new":
      return "Codes are for new accounts, in their first two weeks.";
    default:
      return "Couldn't check that code right now. You can add it later on your page.";
  }
}

export type Progress = { n: number; names: string[] };

/** How many joined on your code, and who. Null when the database is behind. */
export async function referralProgress(sb: SupabaseClient): Promise<Progress | null> {
  const { data, error } = await sb.rpc("referral_progress");
  if (error || !data) return null;
  const d = data as { n?: number; names?: string[] };
  return { n: Number(d.n ?? 0), names: Array.isArray(d.names) ? d.names.map(String) : [] };
}
