"use server";

import { dbConfig } from "@/lib/db";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import { insertSuggestion, type SuggestionAnswers } from "@/lib/suggestions";
import { ATTR_KEYS } from "@/lib/attrs";
import { ASKS, type Ask } from "@/lib/askQuestions";
import { clamp01 } from "@/lib/normalize";
import { whoami } from "@/lib/whoami";
import type { Attrs } from "@/lib/types";

export type RecommendPayload = {
  name: string;
  kind: "bar" | "restaurant";
  neighborhood?: string;
  address?: string;
  why?: string;
  answers: SuggestionAnswers;
  fromName?: string;
  fromContact?: string;
  /** The typed answers (V20). */
  words?: Partial<Record<Ask["key"], string>>;
  /** Their Venmo, for the $2 (V20). */
  venmo?: string;
  /** The session's access token, so the recommendation is tied to the account that gets paid. */
  token?: string;
  /** Honeypot. Humans never see it; bots fill it. */
  website?: string;
};

export type RecommendResult = { ok: true } | { ok: false; error: string };

const cut = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const accountsOn = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

/** Anyone can call this. It only ever writes one row, capped and cleaned. */
export async function submitRecommendation(p: RecommendPayload): Promise<RecommendResult> {
  try {
    if (cut(p.website, 10)) return { ok: true }; // a bot; pretend it worked
    const name = cut(p.name, 80);
    if (name.length < 2) return { ok: false, error: "What's the place called?" };
    if (!dbConfig().writable) return { ok: false, error: "We're not taking recommendations right this second. Try again in a bit." };

    const attrs: Partial<Attrs> = {};
    for (const k of ATTR_KEYS) {
      const v = p.answers?.attrs?.[k];
      if (typeof v === "number" && Number.isFinite(v)) attrs[k] = clamp01(v, 0);
    }
    const answers: SuggestionAnswers = {
      attrs,
      price: [1, 2, 3, 4].includes(Number(p.answers?.price)) ? (Number(p.answers.price) as 1 | 2 | 3 | 4) : undefined,
      easyIn: typeof p.answers?.easyIn === "number" ? clamp01(p.answers.easyIn, 0.5) : undefined,
      groupBig: typeof p.answers?.groupBig === "number" ? clamp01(p.answers.groupBig, 0.5) : undefined,
      dateFit: typeof p.answers?.dateFit === "number" ? clamp01(p.answers.dateFit, 0.5) : undefined,
      said: Array.isArray(p.answers?.said) ? p.answers.said.map((s) => cut(s, 80)).filter(Boolean).slice(0, 20) : [],
    };
    const words: NonNullable<SuggestionAnswers["words"]> = {};
    for (const a of ASKS) {
      const v = cut(p.words?.[a.key], 800);
      if (v) words[a.key] = v;
    }
    if (Object.keys(words).length) answers.words = words;
    const venmo = cut(p.venmo, 40).replace(/^@+/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30) || undefined;
    // Adding a spot takes an account: the token says who. (Without accounts configured at all, anyone can.)
    const me = await whoami(p.token);
    if (!me && accountsOn()) return { ok: false, error: "Sign in to add a spot: your number, a code, done." };

    await insertSuggestion({
      name,
      kind: p.kind === "restaurant" ? "restaurant" : "bar",
      neighborhood: isNeighborhoodId(p.neighborhood) ? p.neighborhood : undefined,
      address: cut(p.address, 160) || undefined,
      why: cut(p.why, 600) || undefined,
      answers,
      fromName: cut(p.fromName, 60) || undefined,
      fromContact: cut(p.fromContact, 80) || undefined,
      userId: me?.id,
      venmo,
    });
    return { ok: true };
  } catch (e) {
    console.error("[recommend]", e);
    return { ok: false, error: "Couldn't send that. That's on our end, not yours." };
  }
}
