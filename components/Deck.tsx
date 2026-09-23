"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { applyAnswer, type Card, type Wants } from "@/lib/questions";

type Answer = "yes" | "no" | "a" | "b" | "skip";

/**
 * The quick ones. A stack of cards; swipe right for yes (or the right-hand
 * option), left for no (or the left-hand option). "Show me" ends it early.
 */
export function Deck({
  cards,
  onDone,
  title = "Quick ones",
}: {
  cards: Card[];
  onDone: (wants: Wants, answered: number) => void;
  title?: string;
}) {
  const [i, setI] = useState(0);
  const [wants, setWants] = useState<Wants>({});
  const [answered, setAnswered] = useState(0);
  const [exitDir, setExitDir] = useState<1 | -1>(1);
  const card = cards[i];
  const remaining = cards.length - i;

  const answer = (a: Answer) => {
    if (!card) return;
    setExitDir(a === "no" || a === "a" ? -1 : 1);
    const next = applyAnswer(wants, card, a);
    const count = answered + (a === "skip" ? 0 : 1);
    setWants(next);
    setAnswered(count);
    if (i + 1 >= cards.length) {
      window.setTimeout(() => onDone(next, count), 180);
    }
    setI(i + 1);
  };

  const stack = useMemo(() => cards.slice(i, i + 2).reverse(), [cards, i]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {title}.
        </h1>
        <span className="text-[12px] font-medium" style={{ color: "var(--chalk-35)" }}>
          {Math.min(i + 1, cards.length)} of {cards.length}
        </span>
      </div>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--chalk-55)" }}>
        Swipe right for yes, left for no. Or tap.
      </p>

      <div className="relative mt-5 flex-1" style={{ minHeight: 300, maxHeight: 420 }}>
        <AnimatePresence custom={exitDir}>
          {stack.map((c, idx) => {
            const top = idx === stack.length - 1;
            return <SwipeCard key={c.id} card={c} top={top} exitDir={exitDir} onSwipe={(dir) => answer(c.kind === "either" ? (dir === "right" ? "b" : "a") : dir === "right" ? "yes" : "no")} />;
          })}
        </AnimatePresence>
        {remaining <= 0 && (
          <div className="card flex h-full items-center justify-center p-6 text-center">
            <p className="serif" style={{ fontSize: 24 }}>
              Got it.
            </p>
          </div>
        )}
      </div>

      {card && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Verdict label={card.kind === "either" ? card.a?.label ?? "Left" : "No"} onClick={() => answer(card.kind === "either" ? "a" : "no")} kind="no" />
          <button onClick={() => answer("skip")} className="pressable text-[12px] font-medium" style={{ color: "var(--chalk-35)" }}>
            Skip
          </button>
          <Verdict label={card.kind === "either" ? card.b?.label ?? "Right" : "Yes"} onClick={() => answer(card.kind === "either" ? "b" : "yes")} kind="yes" />
        </div>
      )}

      <button onClick={() => onDone(wants, answered)} className="pressable btn-primary mx-auto mt-6 flex h-12 items-center px-7 text-[15px]">
        Show me
      </button>
    </div>
  );
}

function SwipeCard({ card, top, exitDir, onSwipe }: { card: Card; top: boolean; exitDir: 1 | -1; onSwipe: (dir: "left" | "right") => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-9, 9]);
  const rightOpacity = useTransform(x, [30, 110], [0, 1]);
  const leftOpacity = useTransform(x, [-30, -110], [0, 1]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100 || info.velocity.x > 550) onSwipe("right");
    else if (info.offset.x < -100 || info.velocity.x < -550) onSwipe("left");
  };
  const rightLabel = card.kind === "either" ? card.b?.label ?? "" : "YES";
  const leftLabel = card.kind === "either" ? card.a?.label ?? "" : "NO";
  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate, zIndex: top ? 2 : 1 }}
      initial={{ scale: top ? 1 : 0.95, y: top ? 0 : 12, opacity: top ? 1 : 0.6 }}
      animate={{ scale: top ? 1 : 0.95, y: top ? 0 : 12, opacity: top ? 1 : 0.6 }}
      exit={{ x: 380 * exitDir, opacity: 0, rotate: 10 * exitDir, transition: { duration: 0.26 } }}
      drag={top ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
    >
      <div
        className="grain relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[28px] p-6"
        style={{ background: `linear-gradient(${card.art.angle ?? 160}deg, ${card.art.from}, ${card.art.to})`, color: "var(--on-photo)", boxShadow: "0 18px 40px -24px rgba(22,33,58,0.6)" }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 60% at 80% 10%, rgba(255,255,255,0.16), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.45) 100%)" }} />
        <motion.span style={{ opacity: rightOpacity }} className="absolute left-5 top-5 rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-[0.14em] uppercase" >
          <span className="rounded-full px-3 py-1.5" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>{rightLabel}</span>
        </motion.span>
        <motion.span style={{ opacity: leftOpacity }} className="absolute right-5 top-5 rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-[0.14em] uppercase">
          <span className="rounded-full px-3 py-1.5" style={{ background: "rgba(22,33,58,0.78)", color: "var(--on-photo)" }}>{leftLabel}</span>
        </motion.span>
        <div className="relative">
          <p className="serif" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {card.prompt}
          </p>
          {card.sub && (
            <p className="mt-2 max-w-[28ch] text-[15px] leading-snug" style={{ color: "var(--on-photo-80)" }}>
              {card.sub}
            </p>
          )}
          {card.kind === "either" && (
            <p className="mt-3 text-[12px] font-medium tracking-wide" style={{ color: "var(--on-photo-60)" }}>
              ← {card.a?.label} · {card.b?.label} →
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Verdict({ label, onClick, kind }: { label: string; onClick: () => void; kind: "yes" | "no" }) {
  return (
    <button
      onClick={onClick}
      className="pressable flex h-14 min-w-[120px] items-center justify-center rounded-full border px-6 text-[15px] font-semibold"
      style={
        kind === "yes"
          ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" }
          : { background: "var(--ink-6)", color: "var(--ink)", borderColor: "var(--hairline-strong)" }
      }
    >
      {label}
    </button>
  );
}
