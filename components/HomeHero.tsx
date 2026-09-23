"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Wordmark } from "./Wordmark";
import { WhenChip } from "./WhenChip";
import { ModeCard } from "./ModeCard";
import { SayIt } from "./SayIt";

/**
 * The front door. Two doors side by side, a third for dinner with the group,
 * and a nudge to scroll: the hero eases back as the "What's hot" shelf rises.
 */
export function HomeHero({ hotCount }: { hotCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.25]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  return (
    <div ref={ref} className="relative flex flex-col" style={{ minHeight: "min(calc(100dvh - var(--tab-height) - env(safe-area-inset-bottom, 0px) - 44px), 760px)" }}>
      <motion.div style={{ scale, opacity, y, transformOrigin: "50% 20%" }} className="flex flex-1 flex-col">
        <header className="flex items-center justify-between pt-4 pb-1">
          <Wordmark />
          <Link href="/hot" className="pressable eyebrow" style={{ color: "var(--ink-35)" }}>
            NYC
          </Link>
        </header>

        <section className="pt-4 pb-3">
          <WhenChip />
          <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            Where should
            <br />
            we go?
          </h1>
        </section>

        {/* Say it, or go by where you are. */}
        <div className="flex items-center gap-2 pb-3">
          <div className="min-w-0 flex-1">
            <SayIt />
          </div>
          <Link
            href="/near"
            className="pressable flex h-[52px] shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold"
            style={{ background: "var(--tomato)", color: "var(--on-photo)" }}
            aria-label="Bars near me"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="10" cy="10" r="1.4" fill="currentColor" />
            </svg>
            Near me
          </Link>
        </div>

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3" style={{ maxHeight: 400 }}>
            <ModeCard
              href="/plan/night"
              label="Night out"
              sub="Bars, for however many of you."
              gradient="linear-gradient(165deg, #143327 0%, #1f4a3c 55%, #2e6b52 100%)"
              delay={0}
            />
            <ModeCard
              href="/plan/date"
              label="Date night"
              sub="Dinner, then the right bar after."
              gradient="linear-gradient(165deg, #8f2a15 0%, #d9482b 60%, #e8694a 100%)"
              delay={0.06}
            />
          </div>
          <ModeCard
            href="/plan/dinner"
            label="Dinner & drinks"
            sub="Food first, then a bar, for the whole group."
            gradient="linear-gradient(160deg, #16213a 0%, #2e4470 100%)"
            delay={0.12}
            size="wide"
            eyebrow="With friends"
          />
          <Link
            href="/search"
            className="pressable flex h-12 shrink-0 items-center gap-3 rounded-full border px-4"
            style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }}
            aria-label="Search a bar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="#16213A" strokeWidth="1.6" />
              <path d="M10.5 10.5 14 14" stroke="#16213A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="truncate text-[14px]" style={{ color: "var(--ink-55)" }}>
              Search a bar you&apos;ve heard about
            </span>
          </Link>
        </section>

      </motion.div>

      {hotCount >= 0 && (
        <motion.a
          href="#hot"
          style={{ opacity: cueOpacity }}
          className="pressable mx-auto mt-4 mb-3 flex shrink-0 flex-col items-center gap-1 text-[11.5px] font-semibold uppercase tracking-[0.16em]"
          aria-label="Scroll to what's hot right now"
        >
          <span style={{ color: "var(--ink-55)" }}>What&apos;s hot right now</span>
          <motion.span animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} aria-hidden style={{ color: "var(--tomato)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v11m0 0-4-4m4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        </motion.a>
      )}
    </div>
  );
}
