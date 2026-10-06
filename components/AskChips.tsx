"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { SEED_QUESTIONS } from "@/lib/crowdQuestions";
import { encodeWants, type Wants } from "@/lib/questions";
import { nowWhen } from "@/lib/when";
import { locate } from "@/lib/locate";
import { formatHour } from "@/lib/time";
import type { AttrKey } from "@/lib/attrs";
import type { NeighborhoodId } from "@/lib/types";

/**
 * Tap it (V35): the ask as a sentence you fill in. "Tonight, in the West
 * Village, for live music, around 9pm." Each blank is a tap; the options
 * open under the sentence and close when you've picked. The blanks use the
 * same words people rate bars with, so what you tap is what the city has
 * answered about, and it's a must-have: every card has it, checked in code.
 * The box below stays for anything these can't say.
 */

type Slot = "where" | "for" | "when";
type Where = NeighborhoodId | "me";

const FOR = (SEED_QUESTIONS.find((q) => q.id === "best-bar")?.options ?? []).filter((o) => Object.values(o.attrs ?? {}).some((v) => (v ?? 0) >= 1));

/** How each neighborhood reads inside the sentence. */
const IN: Record<string, string> = {
  "west-village": "in the West Village",
  "east-village": "in the East Village",
  "lower-east-side": "on the Lower East Side",
  "soho-nolita": "in SoHo",
  tribeca: "in Tribeca",
  chelsea: "in Chelsea",
  "murray-hill": "in Murray Hill",
};
/** And what the night is for. */
const FOR_WORDS: Record<string, string> = {
  late: "a late one",
  dance: "dancing",
  liveMusic: "live music",
  chill: "something chill",
  game: "the game",
  date: "a date",
  group: "the whole group",
};
const WHEN = [
  { key: "now", label: "Now" },
  { key: "19", label: "7pm" },
  { key: "21", label: "9pm" },
  { key: "23", label: "11pm" },
  { key: "25", label: "Late" },
] as const;

const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/* Last time's neighborhood, so the sentence starts half written. Read on the phone, never the server. */
const SAVED = "round:ask";
const noop = () => () => {};
function readSaved(): string {
  try {
    return localStorage.getItem(SAVED) ?? "";
  } catch {
    return "";
  }
}

export function AskChips() {
  const router = useRouter();
  const saved = useSyncExternalStore(noop, readSaved, () => "");
  const [whereState, setWhereState] = useState<Where | null | undefined>(undefined);
  const where: Where | null = whereState === undefined ? (saved && (NEIGHBORHOODS.some((n) => n.id === saved) ? (saved as NeighborhoodId) : null)) || null : whereState;
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState<(typeof WHEN)[number]["key"]>("now");
  const [openState, setOpenState] = useState<Slot | null | undefined>(undefined);
  // Untouched: the first blank sits open, so the first visit sees what to tap; a remembered neighborhood starts it closed.
  const open: Slot | null = openState === undefined ? (where ? null : "where") : openState;
  const setOpen = (v: Slot | null | ((o: Slot | null) => Slot | null)) => setOpenState(typeof v === "function" ? v(open) : v);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const setWhere = (w: Where | null) => {
    setWhereState(w);
    try {
      if (w && w !== "me") localStorage.setItem(SAVED, w);
    } catch {
      /* fine */
    }
  };

  const pickWhere = async (w: Where) => {
    setLocNote(null);
    if (w === "me") {
      const p = await locate("ask");
      if (!p) {
        setLocNote("Location is off for this site; pick a neighborhood instead.");
        return;
      }
      setMe(p);
    }
    setWhere(w);
    setOpen(picked.length ? null : "for");
  };
  const toggleFor = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const go = () => {
    if (!where) return;
    const wants: Wants = {};
    const must: AttrKey[] = [];
    for (const key of picked) {
      const o = FOR.find((x) => x.key === key);
      for (const [a, v] of Object.entries(o?.attrs ?? {}) as [AttrKey, number][]) {
        if (!v) continue;
        wants[a] = Math.max(wants[a] ?? 0, v);
        if (v >= 1 && !must.includes(a)) must.push(a);
      }
    }
    const now = nowWhen();
    const t = when === "now" ? now.hour : Math.max(now.hour, Number(when));
    const sp = new URLSearchParams({ t: String(t), d: String(now.dow) });
    if (where === "me" && me) {
      sp.set("m", "near");
      sp.set("lat", me.lat.toFixed(5));
      sp.set("lng", me.lng.toFixed(5));
    } else {
      sp.set("m", "night");
      sp.set("n", where);
      sp.set("g", "4");
    }
    const w = encodeWants(wants);
    if (w) sp.set("w", w);
    if (must.length) sp.set("must", must.join(","));
    setGoing(true);
    router.push(`/results?${sp.toString()}`);
  };

  const whereWords = where === "me" ? "near me" : where ? IN[where] ?? `in ${NEIGHBORHOODS.find((n) => n.id === where)?.name ?? where}` : null;
  const forWords = picked.length ? `for ${join(picked.map((k) => FOR_WORDS[k] ?? FOR.find((o) => o.key === k)?.label.toLowerCase() ?? k))}` : null;
  const whenWords = when === "now" ? "right now" : when === "25" ? "late" : `around ${formatHour(Number(when), true)}`;

  const slot = (s: Slot, words: string | null, empty: string, soft = false) => (
    <button
      type="button"
      onClick={() => setOpen((o) => (o === s ? null : s))}
      className="pressable inline-flex items-baseline rounded-full align-baseline"
      style={{
        padding: "0 0.42em",
        margin: "0 0.04em",
        lineHeight: 1.15,
        background: words && !soft ? "var(--ink)" : "transparent",
        color: words ? (soft ? "var(--ink)" : "var(--paper)") : "var(--tomato-bright)",
        border: words ? (soft ? "1.5px solid var(--hairline-strong)" : "1.5px solid var(--ink)") : "1.5px dashed var(--tomato-bright)",
        boxShadow: open === s ? "0 0 0 3px rgba(232,105,74,0.35)" : "none",
      }}
      aria-expanded={open === s}
      data-slot={s}
      data-filled={words ? "1" : "0"}
    >
      {words ?? empty}
    </button>
  );

  const chip = (on: boolean) => ({ background: on ? "var(--ink)" : "transparent", color: on ? "var(--paper)" : "var(--ink)", borderColor: on ? "var(--ink)" : "var(--hairline-strong)" });

  return (
    <section className="mt-1 rounded-[26px] border p-4" style={{ borderColor: "var(--hairline-strong)", background: "rgba(246,241,231,0.03)" }} data-ask-chips data-open={open ?? ""}>
      <p className="eyebrow" style={{ color: "var(--tomato-bright)" }}>
        Tap it
      </p>
      <p className="serif mt-2" style={{ fontSize: 26, lineHeight: 1.45, letterSpacing: "-0.015em", color: "var(--ink)" }} data-ask-sentence>
        Tonight, {slot("where", whereWords, "somewhere")}, {slot("for", forWords, "for something")}, {slot("when", whenWords, "around now", when === "now")}.
      </p>

      <AnimatePresence initial={false} mode="wait">
        {open && (
          <motion.div key={open} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="mt-3 flex flex-wrap gap-2" data-slot-options={open}>
            {open === "where" && (
              <>
                <button onClick={() => void pickWhere("me")} className="pressable flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium" style={chip(where === "me")} aria-pressed={where === "me"} data-near-me data-chip-hood="me">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: where === "me" ? "var(--paper)" : "var(--tomato)" }}>
                    <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="10" cy="10" r="1.4" fill="currentColor" />
                  </svg>
                  Near me
                </button>
                {NEIGHBORHOODS.map((n) => (
                  <button key={n.id} onClick={() => void pickWhere(n.id)} className="pressable flex h-10 items-center rounded-full border px-3.5 text-[13.5px] font-medium" style={chip(where === n.id)} aria-pressed={where === n.id} data-chip-hood={n.id}>
                    {n.short}
                  </button>
                ))}
                {locNote && (
                  <p className="w-full text-[12.5px]" style={{ color: "var(--ink-55)" }} data-loc-note>
                    {locNote}
                  </p>
                )}
              </>
            )}
            {open === "for" && (
              <>
                {FOR.map((o) => (
                  <button key={o.key} onClick={() => toggleFor(o.key)} className="pressable flex h-10 items-center rounded-full border px-3.5 text-[13.5px] font-medium" style={chip(picked.includes(o.key))} aria-pressed={picked.includes(o.key)} data-chip-for={o.key}>
                    {o.label}
                  </button>
                ))}
                <p className="w-full text-[12px]" style={{ color: "var(--ink-45)" }}>
                  Pick any. Every bar we show will have it.
                </p>
              </>
            )}
            {open === "when" &&
              WHEN.map((w) => (
                <button
                  key={w.key}
                  onClick={() => {
                    setWhen(w.key);
                    setOpen(null);
                  }}
                  className="pressable flex h-10 items-center rounded-full border px-3.5 text-[13.5px] font-medium"
                  style={chip(when === w.key)}
                  aria-pressed={when === w.key}
                  data-chip-when={w.key}
                >
                  {w.label}
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {where && (
          <motion.button
            key="go"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={go}
            disabled={going}
            className="pressable btn-accent mt-4 flex h-12 w-full items-center justify-center text-[15px] font-semibold"
            style={{ opacity: going ? 0.6 : 1 }}
            data-ask-go
          >
            {going ? "Picking your three…" : "Show me three →"}
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}
