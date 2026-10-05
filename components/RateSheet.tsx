"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useSignInNudge } from "./Actions";
import { ladderSpot, useRoundStore, type Verdict } from "@/lib/store";
import { bestQuestion, chooseQuestions, knownPercent, SEED_QUESTIONS, tagsFromAnswers, type CrowdQuestion } from "@/lib/crowdQuestions";
import { track } from "@/lib/track";
import type { Venue } from "@/lib/types";

/**
 * "Rate this spot" (V32). A verdict in words; what it's best for, in taps;
 * then ROUND's own questions for this place, the ones the city asks for and
 * this place knows least, as many as you feel like (Done is always one tap
 * away); and one line for the group chat. The questions come from
 * /api/rate-questions (the pool the AI writes from the asks); until that
 * answers, the seed pool asks.
 */

export const VERDICTS: { key: Verdict; label: string; sub: string }[] = [
  { key: "again", label: "Take me back tonight.", sub: "Top of the ladder material." },
  { key: "back", label: "I'd go back.", sub: "Solid. On the ladder." },
  { key: "fine", label: "It was fine.", sub: "No notes, no return trip." },
  { key: "never", label: "Never again.", sub: "ROUND will remember." },
];

type Step = "verdict" | "best" | "ask" | "note" | "done";
type Served = { best: CrowdQuestion | null; asks: CrowdQuestion[]; known: number };

function seedServed(kind: "bar" | "restaurant", slug: string, done: string[]): Served {
  return { best: bestQuestion(SEED_QUESTIONS, kind) ?? null, asks: chooseQuestions(SEED_QUESTIONS, kind, slug, {}, done), known: knownPercent(SEED_QUESTIONS, kind, slug, {}) };
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
        setServed(j && Array.isArray(j.asks) ? { best: j.best ?? fallback.best, asks: j.asks, known: typeof j.known === "number" ? j.known : fallback.known } : fallback);
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
  // The meter: what ROUND knew, plus what this person just taught it (one answer is a fifth of a question).
  const known = Math.min(100, Math.round(pool.known + (answered * 100) / Math.max(1, 5 * Math.max(asks.length, 6))));

  const pickVerdict = (v: Verdict) => {
    setVerdict(v);
    setStep(pool.best ? "best" : asks.length ? "ask" : "note");
  };
  const afterBest = () => setStep(asks.length ? "ask" : "note");
  const toggle = (list: string[], key: string, multi: boolean) => (multi ? (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]) : [key]);
  const commit = (keys: string[]) => {
    if (!current) return;
    if (keys.length) {
      setAnswers((a) => ({ ...a, [current.id]: keys }));
      setAnswered((n) => n + 1);
    }
    setPicked([]);
    if (i + 1 < asks.length) setI(i + 1);
    else setStep("note");
  };
  const finish = () => {
    if (!verdict) return;
    const clean = note.trim().slice(0, 140);
    const source = served ? [...(served.best ? [served.best] : []), ...served.asks, ...SEED_QUESTIONS] : SEED_QUESTIONS;
    const tags = tagsFromAnswers(source, bestFor, answers, venue.kind);
    const position = ladderSpot(state, venue.slug, verdict);
    const at = rate(venue.slug, { verdict, tags, note: clean || undefined, bestFor: bestFor.length ? bestFor : undefined, answers: Object.keys(answers).length ? answers : undefined }, position);
    setPlace(at);
    track("save", { slug: venue.slug, data: { source: "rate", verdict, bestFor, answered: Object.keys(answers).length, note: !!clean } });
    setStep("done");
    setRated(true);
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
                <Panel key={`ask-${current.id}`} eyebrow={`ROUND wants to know · ${i + 1}`} title={current.prompt} sub={current.sub ?? (current.multi ? "Pick as many as are true." : undefined)}>
                  <Meter known={known} name={venue.name} />
                  <Chips options={current.options} picked={picked} onPick={(k) => (current.multi ? setPicked((cur) => toggle(cur, k, true)) : commit([k]))} testId={`ask-${current.id}`} />
                  <div className="mt-5 flex gap-2">
                    {current.multi && (
                      <button onClick={() => commit(picked)} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-ask-next>
                        {picked.length ? "Next" : "Skip"}
                      </button>
                    )}
                    <button onClick={() => setStep("note")} className={`pressable btn-ghost flex h-12 items-center justify-center text-[15px] ${current.multi ? "px-5" : "flex-1"}`} data-ask-done>
                      {answered ? "That's enough" : "Skip these"}
                    </button>
                  </div>
                </Panel>
              )}
              {step === "note" && (
                <Panel key="note" eyebrow="Last one" title="One line for the group chat?" sub="Optional. It shows under the place with your first name.">
                  <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={2} placeholder={`"${venue.name}: …"`} className="mt-4 w-full resize-none rounded-[18px] border px-4 py-3 text-[15px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-rate-note />
                  <div className="mt-1 text-right text-[11px]" style={{ color: "var(--ink-35)" }}>
                    {140 - note.length}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={finish} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-rate-finish>
                      {note.trim() ? "Done" : "Skip and finish"}
                    </button>
                  </div>
                </Panel>
              )}
              {step === "done" && (
                <Panel
                  key="done"
                  eyebrow="Noted"
                  title={place !== null && place >= 0 ? `#${place + 1} on your ladder.` : verdict === "never" ? "Never again. Understood." : "It was fine. Noted."}
                  sub={
                    answered
                      ? `ROUND knows ${venue.name} ${known}% now. Every answer makes the next pick sharper, for you and for everyone.`
                      : place !== null && place >= 0
                        ? "ROUND just got a little smarter about you. Your favorites push their way up its picks."
                        : verdict === "never"
                          ? "ROUND won't send you back, and it learned something about what you don't want."
                          : "Noted, and remembered. Every rating makes the next pick sharper."
                  }
                >
                  <div className="mt-5 flex gap-2">
                    <Link href="/you/ladder" className="pressable btn-ghost flex h-12 flex-1 items-center justify-center text-[15px]" onClick={close}>
                      See your ladder
                    </Link>
                    <button onClick={close} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-rate-close>
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

/** "ROUND knows Lucinda's 40%": fills as the answers come in. */
function Meter({ known, name }: { known: number; name: string }) {
  return (
    <div className="mt-3" data-known={known}>
      <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--ink-55)" }}>
        <span>
          ROUND knows {name} <b style={{ color: "var(--ink)" }}>{known}%</b>
        </span>
        <span>{known >= 80 ? "Nearly a regular" : known >= 40 ? "Getting there" : "Still learning"}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--ink-10)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, known)}%`, background: known >= 80 ? "var(--tomato)" : "var(--pine)", transition: "width 300ms ease" }} />
      </div>
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
