"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useRoundStore } from "@/lib/store";

/** Ask from ten hours after the GO tap until four days later; never about a place already rated. */
const FROM_HOURS = 10;
const UNTIL_DAYS = 4;

/**
 * "How was Lucinda's?" (V34): the morning after someone tapped GO, the home
 * page asks, one tap into the rating. This is where most ratings come from,
 * not from people hunting for the button.
 */
export function HowWasIt({ names }: { names: Record<string, string> }) {
  const { state, settleGo } = useRoundStore();
  const [now] = useState(() => Date.now());
  const g = state.lastGo;
  if (!g || g.asked) return null;
  const name = names[g.slug];
  if (!name) return null;
  if (state.been[g.slug]?.verdict) return null;
  const hours = (now - new Date(g.at).getTime()) / 36e5;
  if (!Number.isFinite(hours) || hours < FROM_HOURS || hours > UNTIL_DAYS * 24) return null;
  return (
    <AnimatePresence>
      <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="mt-4 flex items-center gap-3 rounded-[22px] border p-3.5" style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }} data-how-was-it={g.slug}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ border: "2.5px solid var(--tomato)" }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="serif block" style={{ fontSize: 20, lineHeight: 1.1 }}>
            How was {name}?
          </span>
          <span className="mt-0.5 block text-[12px]" style={{ color: "var(--ink-55)" }}>
            You went {hours < 36 ? "last night" : "the other night"}. Thirty seconds, and it goes on your ladder.
          </span>
        </span>
        <Link href={`/v/${g.slug}?rate=1`} className="pressable flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] font-semibold" style={{ background: "var(--tomato)", color: "var(--on-photo)" }} data-how-rate>
          Rate it
        </Link>
        <button onClick={settleGo} className="pressable -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-label="Didn't go" style={{ color: "var(--ink-35)" }} data-how-dismiss>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </motion.section>
    </AnimatePresence>
  );
}
