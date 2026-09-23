"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useSignInNudge } from "./Actions";
import { useRoundStore, type Verdict } from "@/lib/store";
import { track } from "@/lib/track";
import type { Venue } from "@/lib/types";

/**
 * "Rate this bar." Not stars. A verdict in words, what the room actually was
 * (that's the part the algorithm learns from), where it lands on your own
 * ladder against the places you've already rated, and one line for the
 * group chat. Four taps on a good night.
 */

export const VERDICTS: { key: Verdict; label: string; sub: string }[] = [
  { key: "again", label: "Take me back tonight.", sub: "Top of the ladder material." },
  { key: "back", label: "I'd go back.", sub: "Solid. On the ladder." },
  { key: "fine", label: "It was fine.", sub: "No notes, no return trip." },
  { key: "never", label: "Never again.", sub: "ROUND will remember." },
];

export const ROOM_TAGS: { key: string; label: string }[] = [
  { key: "lively", label: "Loud" },
  { key: "chill", label: "Chill" },
  { key: "talk", label: "Could talk" },
  { key: "dance", label: "Dancing" },
  { key: "liveMusic", label: "Live music" },
  { key: "cocktails", label: "Real cocktails" },
  { key: "beer", label: "Beer place" },
  { key: "cheap", label: "Cheap" },
  { key: "upscale", label: "Pricey" },
  { key: "date", label: "Date-y" },
  { key: "groups", label: "Big group" },
  { key: "social", label: "Met people" },
  { key: "dive", label: "Dive" },
  { key: "scene", label: "Sceney" },
  { key: "late", label: "Went late" },
  { key: "food", label: "Good food" },
  { key: "noLine", label: "Walked right in" },
  { key: "line", label: "Long line" },
];

type Step = "verdict" | "tags" | "ladder" | "note" | "done";

export function RateSheet({ venue, names, open, onClose }: { venue: Pick<Venue, "slug" | "name">; names: Record<string, string>; open: boolean; onClose: () => void }) {
  const { state, rate } = useRoundStore();
  const nudge = useSignInNudge("rate");
  const prev = state.been[venue.slug];
  const [step, setStep] = useState<Step>("verdict");
  const [verdict, setVerdict] = useState<Verdict | null>(prev?.verdict ?? null);
  const [tags, setTags] = useState<string[]>(prev?.tags ?? []);
  const [note, setNote] = useState(prev?.note ?? "");
  // Binary insertion against the ladder, at most three questions.
  const others = (state.ladder ?? []).filter((s) => s !== venue.slug);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(others.length);
  const [asked, setAsked] = useState(0);
  const [place, setPlace] = useState<number | null>(null);

  const reset = () => {
    setStep("verdict");
    setLo(0);
    setHi(others.length);
    setAsked(0);
  };
  const [rated, setRated] = useState(false);
  const close = () => {
    onClose();
    window.setTimeout(reset, 300);
    // The one moment ROUND asks for a number: after something worth keeping, once the sheet is away.
    if (rated) {
      setRated(false);
      nudge();
    }
  };

  const pickVerdict = (v: Verdict) => {
    setVerdict(v);
    setStep("tags");
  };
  const afterTags = () => {
    const onLadder = verdict === "again" || verdict === "back";
    if (onLadder && others.length > 0) setStep("ladder");
    else setStep("note");
  };
  const answer = (better: boolean) => {
    const mid = Math.floor((lo + hi) / 2);
    const nlo = better ? lo : mid + 1;
    const nhi = better ? mid : hi;
    const n = asked + 1;
    setLo(nlo);
    setHi(nhi);
    setAsked(n);
    if (nlo >= nhi || n >= 3) setStep("note");
  };
  const finish = () => {
    if (!verdict) return;
    const position = Math.floor((lo + hi) / 2);
    const clean = note.trim().slice(0, 140);
    const at = rate(venue.slug, { verdict, tags, note: clean || undefined }, position);
    setPlace(at);
    track("save", { slug: venue.slug, data: { source: "rate", verdict, tags, note: !!clean } });
    setStep("done");
    setRated(true);
  };

  const mid = Math.floor((lo + hi) / 2);
  const rival = others[mid];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={close} data-rate-sheet>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[28px] border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", minHeight: 380 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-20)" }} />
            <AnimatePresence mode="wait">
              {step === "verdict" && (
                <Panel key="verdict" eyebrow="Rate this bar" title={`How was ${venue.name}?`}>
                  <div className="mt-4 flex flex-col gap-2">
                    {VERDICTS.map((v) => (
                      <button key={v.key} onClick={() => pickVerdict(v.key)} className="pressable flex items-center justify-between rounded-[18px] border px-4 py-3 text-left" style={{ borderColor: verdict === v.key ? "var(--ink)" : "var(--hairline-strong)", background: verdict === v.key ? "rgba(22,33,58,0.06)" : "transparent" }}>
                        <span>
                          <span className="serif block" style={{ fontSize: 21, lineHeight: 1.1 }}>
                            {v.label}
                          </span>
                          <span className="block text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                            {v.sub}
                          </span>
                        </span>
                        <Arrow />
                      </button>
                    ))}
                  </div>
                </Panel>
              )}
              {step === "tags" && (
                <Panel key="tags" eyebrow="What was it?" title="Pick up to three." sub="This is how ROUND learns what a room really is.">
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ROOM_TAGS.map((t) => {
                      const on = tags.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          onClick={() => setTags((cur) => (on ? cur.filter((k) => k !== t.key) : cur.length >= 3 ? cur : [...cur, t.key]))}
                          aria-pressed={on}
                          className="pressable h-10 rounded-full border px-3.5 text-[13.5px] font-medium"
                          style={on ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)", opacity: tags.length >= 3 ? 0.55 : 1 }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={afterTags} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]">
                      {tags.length ? "Next" : "Skip"}
                    </button>
                  </div>
                </Panel>
              )}
              {step === "ladder" && rival && (
                <Panel key={`ladder-${asked}`} eyebrow="Your ladder" title={`Better than ${names[rival] ?? rival}?`} sub={others.length === 1 ? "That's the only other place on your ladder so far." : `Question ${asked + 1} of ${Math.min(3, Math.ceil(Math.log2(others.length + 1)))}.`}>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button onClick={() => answer(true)} className="pressable btn-primary flex h-14 items-center justify-center text-[16px]">
                      Better
                    </button>
                    <button onClick={() => answer(false)} className="pressable btn-ghost flex h-14 items-center justify-center text-[16px]">
                      Not better
                    </button>
                  </div>
                </Panel>
              )}
              {step === "note" && (
                <Panel key="note" eyebrow="Last one" title="One line for the group chat?" sub="Optional. The kind of thing you'd text someone who asked.">
                  <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={2} placeholder={`"${venue.name}: …"`} className="mt-4 w-full resize-none rounded-[18px] border px-4 py-3 text-[15px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
                  <div className="mt-1 text-right text-[11px]" style={{ color: "var(--ink-35)" }}>
                    {140 - note.length}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={finish} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]">
                      {note.trim() ? "Done" : "Skip and finish"}
                    </button>
                  </div>
                </Panel>
              )}
              {step === "done" && (
                <Panel key="done" eyebrow="Noted" title={place !== null && place >= 0 ? `#${place + 1} on your ladder.` : verdict === "never" ? "Never again. Understood." : "It was fine. Noted."} sub={place !== null && place >= 0 ? "ROUND just got a little smarter about you. Your favorites push their way up its picks." : verdict === "never" ? "ROUND won't send you back, and it learned something about what you don't want." : "Noted, and remembered. Every rating makes the next pick sharper."}>
                  <div className="mt-5 flex gap-2">
                    <Link href="/you#ladder" className="pressable btn-ghost flex h-12 flex-1 items-center justify-center text-[15px]" onClick={close}>
                      See your ladder
                    </Link>
                    <button onClick={close} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]">
                      Done
                    </button>
                  </div>
                </Panel>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Panel({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="serif mt-1" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
        {title}
      </h2>
      {sub && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
          {sub}
        </p>
      )}
      {children}
    </motion.div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: "var(--ink-35)" }}>
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
