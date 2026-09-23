"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Wordmark } from "./Wordmark";
import { HomeGreeting } from "./HomeGreeting";
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
    <div ref={ref} className="relative flex flex-col" style={{ minHeight: "calc(100dvh - var(--tab-height) - env(safe-area-inset-bottom, 0px) - 44px)" }}>
      <motion.div style={{ scale, opacity, y, transformOrigin: "50% 20%" }} className="flex flex-1 flex-col">
        <header className="flex items-center justify-between pt-4 pb-1">
          <Wordmark />
          <Link href="/hot" className="pressable eyebrow" style={{ color: "var(--ink-35)" }}>
            NYC
          </Link>
        </header>

        <section className="pt-5 pb-4">
          <HomeGreeting />
          <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            Where should
            <br />
            we go?
          </h1>
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
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
        </section>

        <div className="shrink-0 pt-3">
          <SayIt />
        </div>
      </motion.div>

      {hotCount > 0 && (
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
