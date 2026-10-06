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
 * The front door at night (V33): the wordmark, the day, the question with
 * its words flying in and landing the way they do in the film, the ask box
 * as a cream card on the night page, and one button, Bars near me. Nothing
 * else on the first screen. The hero eases back as the rest rises.
 */
export function HomeHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.35]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 30]);
  // Signed in, ROUND knows your name and says it.
  const { profile } = useAuth();
  const first = (profile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  // "It's Wednesday." from the phone's clock; empty on the server so nothing mismatches.
  const dayName = useSyncExternalStore(
    noop,
    () => DAY_NAMES[nowWhen().dow],
    () => "",
  );
  const words = [
    "Where",
    "should",
    "\n",
    "we",
    "go",
    first ? `tonight, ${first}?` : "tonight?",
  ];

  return (
    <div ref={ref} className="relative flex flex-col pb-5" data-hero>
      <motion.div
        style={{ scale, opacity, y, transformOrigin: "50% 20%" }}
        className="flex flex-1 flex-col"
      >
        <header className="flex items-center gap-3 pt-4 pb-1">
          <Wordmark />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <Link
              href="/best"
              className="pressable eyebrow shrink-0"
              style={{ color: "var(--ink-45)" }}
              data-nyc-link
            >
              NYC
            </Link>
          </div>
        </header>

        <section className="pt-5 pb-3">
          <p
            className="eyebrow"
            style={{ color: "var(--tomato-bright)", minHeight: 14 }}
            data-day-line
          >
            {dayName ? `It's ${dayName}.` : ""}
          </p>
          <h1
            className="serif mt-2"
            style={{
              fontSize: 44,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
            }}
            data-hello={first || undefined}
            aria-label={`Where should we go ${first ? `tonight, ${first}` : "tonight"}?`}
          >
            {words.map((w, i) =>
              w === "\n" ? (
                <br key={i} />
              ) : (
                <motion.span
                  key={i}
                  initial={{
                    opacity: 0,
                    x: i % 2 ? 48 : -48,
                    y: 10,
                    rotate: i % 2 ? 3 : -3,
                  }}
                  animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 170,
                    damping: 14,
                    mass: 0.7,
                    delay: 0.08 + i * 0.09,
                  }}
                  className="inline-block"
                  style={{ marginRight: "0.22em" }}
                  aria-hidden
                >
                  {w.endsWith("?") ? (
                    <>
                      {w.slice(0, -1)}
                      <span style={{ color: "var(--tomato)" }}>?</span>
                    </>
                  ) : (
                    w
                  )}
                </motion.span>
              ),
            )}
          </h1>
        </section>

        {/* The one thing on the first screen: the box, with the quick taps inside it (V35). */}
        <SayIt />
      </motion.div>
    </div>
  );
}
