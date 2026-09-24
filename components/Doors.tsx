"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ModeCard } from "./ModeCard";

/**
 * The four doors, under the first screen (V27). They sit a little blurred and
 * faded until you scroll to them, then they're there: the home screen is the
 * search box first, and these are for when you don't know what you want yet.
 */
export function Doors() {
  const ref = useRef<HTMLElement>(null);
  // From "just entering at the bottom" to "a third of the way up": blur and fade lift as you scroll.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 38%"] });
  const blur = useTransform(scrollYProgress, [0, 1], ["blur(10px)", "blur(0px)"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [18, 0]);

  return (
    <section ref={ref} id="doors" className="scroll-mt-3 pt-2" data-doors-section>
      <motion.div style={{ filter: blur, opacity, y }} className="flex flex-col gap-2.5" data-doors-blur>
        <p className="eyebrow pb-1" style={{ color: "var(--ink-55)" }}>
          Pick a door.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <ModeCard href="/plan/night" label="Night out" sub="Bars, for however many of you." gradient="linear-gradient(165deg, #143327 0%, #1f4a3c 55%, #2e6b52 100%)" delay={0} />
          <ModeCard href="/plan/date" label="Date night" sub="Dinner, then the right bar after." gradient="linear-gradient(165deg, #8f2a15 0%, #d9482b 60%, #e8694a 100%)" delay={0.06} />
        </div>
        <ModeCard href="/plan/dinner" label="Dinner & drinks" sub="Food first, then a bar, for the whole group." gradient="linear-gradient(160deg, #16213a 0%, #2e4470 100%)" delay={0.12} size="wide" eyebrow="With friends" />
        <ModeCard href="/plan/day" label="Brunch, day drinking, happy hour" gradient="linear-gradient(160deg, #8a5a12 0%, #d9a441 100%)" delay={0.18} size="slim" eyebrow="In daylight" />
      </motion.div>
    </section>
  );
}
