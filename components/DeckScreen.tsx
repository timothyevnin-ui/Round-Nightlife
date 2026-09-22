"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Deck } from "./Deck";
import type { Card, Wants } from "@/lib/questions";

/** The deck, in the same chrome as the question steps (glow, back, close). */
export function DeckScreen({
  title,
  cards,
  onBack,
  onDone,
}: {
  title: string;
  cards: Card[];
  onBack: () => void;
  onDone: (wants: Wants, answered: number) => void;
}) {
  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ minHeight: "100dvh" }}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ background: "radial-gradient(90% 55% at 50% -10%, rgba(95,140,255,0.42), transparent 70%)" }}
      />
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative z-10 flex flex-1 flex-col pt-4 pb-8">
        <Deck cards={cards} onDone={onDone} />
      </motion.div>
    </main>
  );
}
