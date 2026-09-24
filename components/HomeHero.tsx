"use client";

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Wordmark } from "./Wordmark";
import { SayIt } from "./SayIt";
import { useAuth } from "@/lib/auth";
import { DAY_NAMES } from "@/lib/time";
import { nowWhen } from "@/lib/when";

const noop = () => () => {};

/**
 * The front door (V27): the hello, then the search box, big and dark, as the
 * one thing on the first screen. "Bars near me" beside a nudge to scroll; the
 * four doors wait under the fold, blurred until you get to them. The hero eases
 * back as the rest rises.
 */
export function HomeHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 36]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  // Signed in, ROUND knows your name and says it.
  const { profile } = useAuth();
  const first = (profile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  // "It's Wednesday." from the phone's clock; empty on the server so nothing mismatches.
  const dayName = useSyncExternalStore(noop, () => DAY_NAMES[nowWhen().dow], () => "");

  return (
    <div ref={ref} className="relative flex flex-col pb-5" data-hero>
      <motion.div style={{ scale, opacity, y, transformOrigin: "50% 20%" }} className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 pt-4 pb-1">
          <Wordmark />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <Link href="/hot" className="pressable eyebrow shrink-0" style={{ color: "var(--ink-35)" }}>
              NYC
            </Link>
          </div>
        </header>

        <section className="pt-2 pb-3">
          <p className="eyebrow" style={{ color: "var(--ink-70)", minHeight: 14 }} data-day-line>
            {dayName ? `It's ${dayName}.` : ""}
          </p>
          <h1 className="serif mt-1.5" style={{ fontSize: 36, lineHeight: 1.02, letterSpacing: "-0.02em" }} data-hello={first || undefined}>
            Where should
            <br />
            we go{first ? `, ${first}` : ""}?
          </h1>
        </section>

        {/* The one thing on the first screen. */}
        <SayIt />

        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/near"
            className="pressable flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold"
            style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)", color: "var(--ink)" }}
            aria-label="Bars near me"
            data-near-me
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: "var(--tomato)" }}>
              <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="10" cy="10" r="1.4" fill="currentColor" />
            </svg>
            Bars near me
          </Link>
          <motion.a
            href="#doors"
            style={{ opacity: cueOpacity }}
            className="pressable flex items-center gap-1.5 pr-1 text-[11.5px] font-semibold uppercase tracking-[0.14em]"
            aria-label="Don't know yet? Scroll to the doors"
            data-scroll-cue
          >
            <span style={{ color: "var(--ink-55)" }}>Don&apos;t know yet?</span>
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} aria-hidden style={{ color: "var(--tomato)" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v11m0 0-4-4m4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </motion.a>
        </div>
      </motion.div>
    </div>
  );
}
