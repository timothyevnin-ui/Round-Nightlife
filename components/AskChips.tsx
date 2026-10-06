"use client";

import { useSyncExternalStore } from "react";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { SEED_QUESTIONS } from "@/lib/crowdQuestions";
import { encodeWants, type Wants } from "@/lib/questions";
import type { AttrKey } from "@/lib/attrs";
import type { NeighborhoodId } from "@/lib/types";

/**
 * The quick taps inside Just say it (V35): a row of neighborhoods and a row
 * of what the night is for, in the words people rate bars with. They write
 * the ask for you: tap West Village and Live music and the box reads
 * "West Village · live music" and the arrow lights up. Typing on top of
 * that still works; what you tapped stays a must-have, checked in code.
 */

export type Hood = NeighborhoodId | "me";

export const FOR = (SEED_QUESTIONS.find((q) => q.id === "best-bar")?.options ?? []).filter((o) => Object.values(o.attrs ?? {}).some((v) => (v ?? 0) >= 1));

const FOR_WORDS: Record<string, string> = {
  late: "a late one",
  dance: "dancing",
  liveMusic: "live music",
  chill: "something chill",
  game: "the game",
  date: "a date",
  group: "the whole group",
};

export function hoodWords(h: Hood | null): string | null {
  if (!h) return null;
  if (h === "me") return "near me";
  return NEIGHBORHOODS.find((n) => n.id === h)?.short ?? h;
}

/** "West Village · live music, a late one" */
export function composeAsk(hood: Hood | null, picks: string[]): string {
  const where = hoodWords(hood);
  const what = picks.map((k) => FOR_WORDS[k] ?? FOR.find((o) => o.key === k)?.label.toLowerCase() ?? k).join(", ");
  return [where, what].filter(Boolean).join(" · ");
}

/** The wants and the must-haves that the taps mean. */
export function tappedWants(picks: string[]): { wants: Wants; must: AttrKey[] } {
  const wants: Wants = {};
  const must: AttrKey[] = [];
  for (const key of picks) {
    const o = FOR.find((x) => x.key === key);
    for (const [a, v] of Object.entries(o?.attrs ?? {}) as [AttrKey, number][]) {
      if (!v) continue;
      wants[a] = Math.max(wants[a] ?? 0, v);
      if (v >= 1 && !must.includes(a)) must.push(a);
    }
  }
  return { wants, must };
}

export function tappedParams(picks: string[]): { w?: string; must?: string } {
  const { wants, must } = tappedWants(picks);
  const w = encodeWants(wants);
  return { ...(w ? { w } : {}), ...(must.length ? { must: must.join(",") } : {}) };
}

/* Last time's neighborhood, remembered on the phone, never the server. */
const SAVED = "round:ask";
const noop = () => () => {};
function readSaved(): string {
  try {
    return localStorage.getItem(SAVED) ?? "";
  } catch {
    return "";
  }
}
export function useSavedHood(): NeighborhoodId | null {
  const saved = useSyncExternalStore(noop, readSaved, () => "");
  return NEIGHBORHOODS.some((n) => n.id === saved) ? (saved as NeighborhoodId) : null;
}
export function rememberHood(h: Hood | null) {
  try {
    if (h && h !== "me") localStorage.setItem(SAVED, h);
  } catch {
    /* fine */
  }
}

export function AskChips({ hood, picks, onHood, onPick, locNote }: { hood: Hood | null; picks: string[]; onHood: (h: Hood) => void; onPick: (key: string) => void; locNote?: string | null }) {
  const chip = (on: boolean) => ({
    background: on ? "var(--ink)" : "transparent",
    color: on ? "var(--paper)" : "var(--ink)",
    borderColor: on ? "var(--ink)" : "var(--hairline-strong)",
  });
  const cls = "pressable flex h-8 shrink-0 items-center rounded-full border px-3 text-[12.5px] font-medium";
  return (
    <div className="mt-3.5" data-ask-chips>
      <div className="flex flex-wrap items-center gap-1.5" data-chips-where>
        <span className="mr-1 w-10 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-45)" }}>
          Where
        </span>
        <button type="button" onClick={() => onHood("me")} className={`${cls} gap-1`} style={chip(hood === "me")} aria-pressed={hood === "me"} data-near-me data-chip-hood="me">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: hood === "me" ? "var(--paper)" : "var(--tomato)" }}>
            <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="2" />
            <circle cx="10" cy="10" r="1.4" fill="currentColor" />
          </svg>
          Near me
        </button>
        {NEIGHBORHOODS.map((n) => (
          <button key={n.id} type="button" onClick={() => onHood(n.id)} className={cls} style={chip(hood === n.id)} aria-pressed={hood === n.id} data-chip-hood={n.id}>
            {n.short}
          </button>
        ))}
      </div>
      {locNote && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--tomato)" }} data-loc-note>
          {locNote}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5" data-chips-for>
        <span className="mr-1 w-10 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-45)" }}>
          For
        </span>
        {FOR.map((o) => (
          <button key={o.key} type="button" onClick={() => onPick(o.key)} className={cls} style={chip(picks.includes(o.key))} aria-pressed={picks.includes(o.key)} data-chip-for={o.key}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
