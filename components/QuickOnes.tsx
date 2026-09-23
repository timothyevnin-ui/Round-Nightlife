"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { applyAnswer, nextCard, type Card, type Wants } from "@/lib/questions";
import { usualAnswers, useRoundStore } from "@/lib/store";

/**
 * The quick ones. Each question types itself out, then two or three buttons
 * appear. Tap one, the next question types. No cards, no swiping, no thinking.
 */
export function QuickOnes({ title, cards, onBack, onDone }: { title: string; cards: Card[]; onBack: () => void; onDone: (wants: Wants, answered: number) => void }) {
  const [i, setI] = useState(() => nextCard(cards, 0, {}));
  const [wants, setWants] = useState<Wants>({});
  const [answered, setAnswered] = useState(0);
  const card = cards[i];
  // What's left to ask, given the answers so far (branching cards drop out as they become redundant).
  const remaining = cards.slice(i).filter((c) => !c.showIf || c.showIf(wants)).length;
  const total = answered + remaining;

  const { state, remember } = useRoundStore();
  const usual = useMemo(() => Object.fromEntries(usualAnswers(state)), [state]);
  const usualFor = (id: string): string | undefined => usual[id];
  const answer = (a: number | "skip") => {
    if (!card) return;
    if (a !== "skip") remember(card.id, card.options[a].label);
    const next = applyAnswer(wants, card, a);
    const count = answered + (a === "skip" ? 0 : 1);
    setWants(next);
    setAnswered(count);
    const k = nextCard(cards, i + 1, next);
    if (k >= cards.length) window.setTimeout(() => onDone(next, count), 220);
    setI(k);
  };

  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ minHeight: "100dvh" }}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: "radial-gradient(90% 55% at 50% -10%, var(--walk-3), transparent 70%)" }} />
      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        <button onClick={onBack} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">{title}</span>
        <Link href="/" className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 flex-col pt-4 pb-8">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Quick ones</p>
          <span className="text-[12px] font-medium" style={{ color: "var(--ink-35)" }}>
            {Math.min(answered + 1, total)} of {total}
          </span>
        </div>
        {/* Progress */}
        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, k) => (
            <span key={k} className="block h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: k < answered ? "var(--ink)" : k === answered ? "var(--tomato)" : "var(--ink-10)" }} />
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait">
            {card ? (
              <Question key={card.id} card={card} onAnswer={answer} usual={usualFor(card.id)} />
            ) : (
              <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-center" style={{ fontSize: 34 }}>
                Got it.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => answer("skip")} disabled={!card} className="pressable text-[13px] font-medium" style={{ color: "var(--ink-35)" }}>
            Skip this one
          </button>
          <button onClick={() => onDone(wants, answered)} className="pressable btn-ghost flex h-11 items-center px-5 text-[14px]">
            Show me now
          </button>
        </div>
      </div>
    </main>
  );
}

function Question({ card, onAnswer, usual }: { card: Card; onAnswer: (i: number) => void; usual?: string }) {
  const typed = useTypewriter(card.prompt);
  const ready = typed.length >= card.prompt.length;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }}>
      <TypedHeading text={card.prompt} typed={typed} ready={ready} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 8 }}
        transition={{ duration: 0.25 }}
        className={`mt-8 grid gap-3 ${card.options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
        style={{ pointerEvents: ready ? "auto" : "none" }}
      >
        {card.options.map((o, k) => {
          // Your usual answer leads (ink), the way the first option normally does.
          const lead = usual ? o.label === usual : k === 0;
          return (
            <button
              key={o.label}
              onClick={() => onAnswer(k)}
              className="pressable relative flex h-16 min-w-[120px] items-center justify-center rounded-full border px-4 text-[17px] font-semibold"
              style={lead ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline-strong)" }}
              data-usual={o.label === usual ? "1" : undefined}
            >
              {o.label}
              {o.label === usual && (
                <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
                  usually
                </span>
              )}
            </button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

/** The big serif question with a blinking tomato cursor while it types. */
export function TypedHeading({ text, typed, ready, size = 44 }: { text: string; typed: string; ready: boolean; size?: number }) {
  return (
    <h1 className="serif" style={{ fontSize: size, lineHeight: 1.04, letterSpacing: "-0.02em", minHeight: "2.1em" }} aria-label={text}>
      {typed}
      <span aria-hidden className="inline-block align-baseline" style={{ width: 3, height: "0.85em", marginLeft: 3, background: ready ? "transparent" : "var(--tomato)", transform: "translateY(0.1em)" }} />
    </h1>
  );
}

/** Types `text` one character at a time; a tap anywhere finishes it early. */
export function useTypewriter(text: string, cps = 38) {
  // The count is stored with the text it belongs to, so a new prompt starts
  // from zero without a reset call inside the effect.
  const [st, setSt] = useState<{ text: string; n: number }>({ text, n: 0 });
  useEffect(() => {
    let k = 0;
    const id = window.setInterval(() => {
      k += 1;
      setSt({ text, n: k });
      if (k >= text.length) window.clearInterval(id);
    }, 1000 / cps);
    const finish = () => {
      window.clearInterval(id);
      setSt({ text, n: text.length });
    };
    window.addEventListener("pointerdown", finish, { once: true });
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", finish);
    };
  }, [text, cps]);
  const n = st.text === text ? st.n : 0;
  return text.slice(0, n);
}
