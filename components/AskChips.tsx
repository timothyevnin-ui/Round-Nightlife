"use client";

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

export type ForOption = { key: string; label: string; attrs?: Partial<Record<AttrKey, number>> };

/** The Best-for words, as the chips: only the ones that mean one thing the engine can check. */
export const forOptions = (options?: ForOption[] | null): ForOption[] => ((options?.length ? options : SEED_QUESTIONS.find((q) => q.id === "best-bar")?.options) ?? []).filter((o) => Object.values(o.attrs ?? {}).some((v) => (v ?? 0) >= 1));
export const FOR = forOptions();

const FOR_WORDS: Record<string, string> = {
  late: "a late one",
  dance: "dancing",
  liveMusic: "live music",
  chill: "something chill",
  game: "the game",
  date: "a date",
  group: "the whole group",
  day: "day drinking",
  happyHour: "happy hour",
};

export function hoodWords(h: Hood | null): string | null {
  if (!h) return null;
  if (h === "me") return "near me";
  return NEIGHBORHOODS.find((n) => n.id === h)?.short ?? h;
}

/** "West Village · live music, a late one" */
export function composeAsk(hood: Hood | null, picks: string[], options: ForOption[] = FOR): string {
  const where = hoodWords(hood);
  const what = picks.map((k) => FOR_WORDS[k] ?? options.find((o) => o.key === k)?.label.toLowerCase() ?? k).join(", ");
  return [where, what].filter(Boolean).join(" · ");
}

/** The wants and the must-haves that the taps mean. */
export function tappedWants(picks: string[], options: ForOption[] = FOR): { wants: Wants; must: AttrKey[] } {
  const wants: Wants = {};
  const must: AttrKey[] = [];
  for (const key of picks) {
    const o = options.find((x) => x.key === key);
    for (const [a, v] of Object.entries(o?.attrs ?? {}) as [AttrKey, number][]) {
      if (!v) continue;
      wants[a] = Math.max(wants[a] ?? 0, v);
      if (v >= 1 && !must.includes(a)) must.push(a);
    }
  }
  return { wants, must };
}

export function tappedParams(picks: string[], options: ForOption[] = FOR): { w?: string; must?: string } {
  const { wants, must } = tappedWants(picks, options);
  const w = encodeWants(wants);
  return { ...(w ? { w } : {}), ...(must.length ? { must: must.join(",") } : {}) };
}

export function AskChips({ hood, picks, onHood, onPick, locNote, options = FOR }: { hood: Hood | null; picks: string[]; onHood: (h: Hood) => void; onPick: (key: string) => void; locNote?: string | null; options?: ForOption[] }) {
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
        {options.map((o) => (
          <button key={o.key} type="button" onClick={() => onPick(o.key)} className={cls} style={chip(picks.includes(o.key))} aria-pressed={picks.includes(o.key)} data-chip-for={o.key}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
