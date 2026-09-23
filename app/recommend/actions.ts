"use server";

import { dbConfig } from "@/lib/db";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import { insertSuggestion, type SuggestionAnswers } from "@/lib/suggestions";
import { ATTR_KEYS } from "@/lib/attrs";
import { clamp01 } from "@/lib/normalize";
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
  /** Honeypot. Humans never see it; bots fill it. */
  website?: string;
};

export type RecommendResult = { ok: true } | { ok: false; error: string };

const cut = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

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

    await insertSuggestion({
      name,
      kind: p.kind === "restaurant" ? "restaurant" : "bar",
      neighborhood: isNeighborhoodId(p.neighborhood) ? p.neighborhood : undefined,
      address: cut(p.address, 160) || undefined,
      why: cut(p.why, 600) || undefined,
      answers,
      fromName: cut(p.fromName, 60) || undefined,
      fromContact: cut(p.fromContact, 80) || undefined,
    });
    return { ok: true };
  } catch (e) {
    console.error("[recommend]", e);
    return { ok: false, error: "Couldn't send that. That's on our end, not yours." };
  }
}
