"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useSignInNudge } from "./Actions";
import { ladderSpot, useRoundStore, type Verdict } from "@/lib/store";
import { bestQuestion, chooseQuestions, SEED_QUESTIONS, tagsFromAnswers, type CrowdQuestion } from "@/lib/crowdQuestions";
import { track } from "@/lib/track";
import type { Venue } from "@/lib/types";

/**
 * "Rate this spot" (V32, loosened in V34). A verdict in words; what it's
 * best for, in taps; then ROUND's own questions for this place, the ones the
 * city asks for and this place knows least, one after another, for as long
 * as you feel like: the big Done button saves on the spot, whenever. No
 * meter, no "3 of 12". The line for the group chat is an extra on the last
 * screen, not a gate. The questions come from /api/rate-questions (the pool
 * the AI writes from the asks); until that answers, the seed pool asks.
 */

export const VERDICTS: { key: Verdict; label: string; sub: string }[] = [
  { key: "again", label: "Take me back tonight.", sub: "Top of the ladder material." },
  { key: "back", label: "I'd go back.", sub: "Solid. On the ladder." },
  { key: "fine", label: "It was fine.", sub: "No notes, no return trip." },
  { key: "never", label: "Never again.", sub: "ROUND will remember." },
];

type Step = "verdict" | "best" | "ask" | "done";
type Served = { best: CrowdQuestion | null; asks: CrowdQuestion[] };

function seedServed(kind: "bar" | "restaurant", slug: string, done: string[]): Served {
  return { best: bestQuestion(SEED_QUESTIONS, kind) ?? null, asks: chooseQuestions(SEED_QUESTIONS, kind, slug, {}, done) };
}

export function RateSheet({ venue, open, onClose }: { venue: Pick<Venue, "slug" | "name" | "kind">; names?: Record<string, string>; open: boolean; onClose: () => void }) {
  const { state, rate } = useRoundStore();
  const nudge = useSignInNudge("rate");
  const prev = state.been[venue.slug];
  const [step, setStep] = useState<Step>("verdict");
  const [verdict, setVerdict] = useState<Verdict | null>(prev?.verdict ?? null);
  const [bestFor, setBestFor] = useState<string[]>(prev?.bestFor ?? []);
  const [answers, setAnswers] = useState<Record<string, string[]>>(prev?.answers ?? {});
  const [note, setNote] = useState(prev?.note ?? "");
  const [served, setServed] = useState<Served | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [place, setPlace] = useState<number | null>(null);
  const [rated, setRated] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [savedNote, setSavedNote] = useState(prev?.note ?? "");
  const doneBefore = useMemo(() => Object.keys(prev?.answers ?? {}), [prev?.answers]);

  // Ask ROUND what it wants to know about this place, once the sheet opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const fallback = seedServed(venue.kind, venue.slug, doneBefore);
    fetch(`/api/rate-questions?slug=${encodeURIComponent(venue.slug)}${doneBefore.length ? `&done=${encodeURIComponent(doneBefore.join(","))}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Served | null) => {
        if (!live) return;
        setServed(j && Array.isArray(j.asks) ? { best: j.best ?? fallback.best, asks: j.asks } : fallback);
      })
      .catch(() => live && setServed(fallback));
    return () => {
      live = false;
    };
  }, [open, venue.slug, venue.kind, doneBefore]);

  const reset = () => {
    setStep("verdict");
    setI(0);
    setPicked([]);
    setAnswered(0);
  };
  const close = () => {
    if (step === "done") addLine();
    onClose();
    window.setTimeout(reset, 300);
    // The one moment ROUND asks for a number: after something worth keeping, once the sheet is away.
    if (rated) {
      setRated(false);
      nudge();
    }
  };

  const pool = served ?? seedServed(venue.kind, venue.slug, doneBefore);
  const asks = pool.asks;
  const current = asks[i];

  const toggle = (list: string[], key: string, multi: boolean) => (multi ? (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]) : [key]);
  const entry = (v: Verdict, a: Record<string, string[]>, line: string) => {
    const source = served ? [...(served.best ? [served.best] : []), ...served.asks, ...SEED_QUESTIONS] : SEED_QUESTIONS;
    const clean = line.trim().slice(0, 140);
    return { verdict: v, tags: tagsFromAnswers(source, bestFor, a, venue.kind), note: clean || undefined, bestFor: bestFor.length ? bestFor : undefined, answers: Object.keys(a).length ? a : undefined };
  };
  /** Save it, right now, with whatever's been answered so far: the big button, and the end of the questions. */
  const finish = (a: Record<string, string[]> = answers, v: Verdict | null = verdict) => {
    if (!v) return;
    const at = rate(venue.slug, entry(v, a, note), ladderSpot(state, venue.slug, v));
    setPlace(at);
    setSavedNote(note.trim());
    track("save", { slug: venue.slug, data: { source: "rate", verdict: v, bestFor, answered: Object.keys(a).length, note: !!note.trim() } });
    setStep("done");
    setRated(true);
  };
  const pickVerdict = (v: Verdict) => {
    setVerdict(v);
    if (pool.best) setStep("best");
    else if (asks.length) setStep("ask");
    else finish(answers, v);
  };
  const afterBest = () => (asks.length ? setStep("ask") : finish());
  const commit = (keys: string[]) => {
    if (!current) return;
    const next = keys.length ? { ...answers, [current.id]: keys } : answers;
    if (keys.length) {
      setAnswers(next);
      setAnswered((n) => n + 1);
    }
    setPicked([]);
    if (i + 1 < asks.length) setI(i + 1);
    else finish(next);
  };
  /** The line for the group chat, added after the fact: the same rating, same rung, plus the line. */
  const addLine = () => {
    const clean = note.trim();
    if (!verdict || clean === savedNote) return;
    rate(venue.slug, entry(verdict, answers, clean), place !== null && place >= 0 ? place : undefined);
    setSavedNote(clean);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "var(--scrim)", backdropFilter: "blur(6px)" }} onClick={close} data-rate-sheet>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="theme-paper w-full max-w-md rounded-t-[28px] border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", minHeight: 380 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-20)" }} />
            <AnimatePresence mode="wait">
              {step === "verdict" && (
                <Panel key="verdict" eyebrow={`Rate this ${venue.kind === "restaurant" ? "spot" : "bar"}`} title={`How was ${venue.name}?`}>
                  <div className="mt-4 flex flex-col gap-2">
                    {VERDICTS.map((v) => (
                      <button key={v.key} onClick={() => pickVerdict(v.key)} className="pressable flex items-center justify-between rounded-[18px] border px-4 py-3 text-left" style={{ borderColor: verdict === v.key ? "var(--ink)" : "var(--hairline-strong)", background: verdict === v.key ? "var(--ink-6)" : "transparent" }} data-verdict={v.key}>
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
              {step === "best" && pool.best && (
                <Panel key="best" eyebrow="Best for" title={pool.best.prompt} sub={pool.best.sub ?? "Pick as many as are true."}>
                  <Chips options={pool.best.options} picked={bestFor} onPick={(k) => setBestFor((cur) => toggle(cur, k, true))} testId="best" />
                  <div className="mt-5 flex gap-2">
                    <button onClick={afterBest} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-best-next>
                      {bestFor.length ? "Next" : "Skip"}
                    </button>
                  </div>
                </Panel>
              )}
              {step === "ask" && current && (
                <Panel key={`ask-${current.id}`} eyebrow={answered ? `ROUND wants to know · ${answered} answered` : "ROUND wants to know"} title={current.prompt} sub={current.sub ?? (current.multi ? "Pick as many as are true." : undefined)}>
                  <Chips options={current.options} picked={picked} onPick={(k) => (current.multi ? setPicked((cur) => toggle(cur, k, true)) : commit([k]))} testId={`ask-${current.id}`} />
                  {current.multi && picked.length > 0 ? (
                    <button onClick={() => commit(picked)} className="pressable btn-ghost mt-5 flex h-12 w-full items-center justify-center text-[15px]" data-ask-next>
                      Next question
                    </button>
                  ) : (
                    <button onClick={() => commit([])} className="pressable mt-5 flex h-10 w-full items-center justify-center text-[14px] font-medium" style={{ color: "var(--ink-55)" }} data-ask-next>
                      Skip this one
                    </button>
                  )}
                  <button onClick={() => finish()} className="pressable btn-primary mt-2 flex h-14 w-full flex-col items-center justify-center rounded-[20px] text-[17px] font-semibold" data-ask-done>
                    <span>{answered ? "Done, save it" : "Done"}</span>
                    <span className="text-[11px] font-normal opacity-70">Leave whenever. Your rating&apos;s kept either way.</span>
                  </button>
                </Panel>
              )}
              {step === "done" && (
                <Panel
                  key="done"
                  eyebrow="Noted"
                  title={place !== null && place >= 0 ? `#${place + 1} on your ladder.` : verdict === "never" ? "Never again. Understood." : "It was fine. Noted."}
                  sub={
                    answered
                      ? `${answered} ${answered === 1 ? "answer" : "answers"} about ${venue.name}, kept. Every one makes the next pick sharper, for you and for everyone.`
                      : place !== null && place >= 0
                        ? "ROUND just got a little smarter about you. Your favorites push their way up its picks."
                        : verdict === "never"
                          ? "ROUND won't send you back, and it learned something about what you don't want."
                          : "Noted, and remembered. Every rating makes the next pick sharper."
                  }
                >
                  <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} onBlur={addLine} rows={2} placeholder="One line for the group chat? Optional. It shows under the place with your first name." className="mt-4 w-full resize-none rounded-[18px] border px-4 py-3 text-[15px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-rate-note />
                  <div className="mt-3 flex gap-2">
                    <Link href="/you/ladder" className="pressable btn-ghost flex h-12 flex-1 items-center justify-center text-[15px]" onClick={close}>
                      See your ladder
                    </Link>
                    <button onClick={close} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-rate-close>
                      {note.trim() && note.trim() !== savedNote ? "Add it and close" : "Done"}
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

function Chips({ options, picked, onPick, testId }: { options: CrowdQuestion["options"]; picked: string[]; onPick: (key: string) => void; testId: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2" data-chips={testId}>
      {options.map((o) => {
        const on = picked.includes(o.key);
        return (
          <button key={o.key} onClick={() => onPick(o.key)} aria-pressed={on} className="pressable h-11 rounded-full border px-4 text-[14px] font-medium" style={on ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }} data-chip={o.key}>
            {o.label}
          </button>
        );
      })}
    </div>
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
