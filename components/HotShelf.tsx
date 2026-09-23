"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

/**
 * "What's hot right now" — the shelf under the front door. Each entry is a
 * place with a story behind it, written in the back office. Cards rise in as
 * you scroll; the first line of the story is the hook.
 */
export function HotShelf({ venues, compact = false }: { venues: Venue[]; compact?: boolean }) {
  if (venues.length === 0) return null;
  return (
    <section id="hot" className="scroll-mt-4 pt-10 pb-6">
      <motion.header
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ type: "spring", stiffness: 240, damping: 28 }}
        className="flex items-end justify-between"
      >
        <div>
          <p className="eyebrow" style={{ color: "var(--tomato)" }}>
            ROUND&apos;s picks · right now
          </p>
          <h2 className="serif mt-1.5" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }}>
            What&apos;s hot
            <br />
            right now.
          </h2>
        </div>
        {!compact && (
          <Link href="/hot" className="pressable pb-1 text-[12.5px] font-medium" style={{ color: "var(--ink-55)" }}>
            All of them
          </Link>
        )}
      </motion.header>

      <ol className="mt-6 flex flex-col gap-4">
        {venues.map((v, i) => (
          <motion.li
            key={v.slug}
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ type: "spring", stiffness: 240, damping: 28, delay: Math.min(i, 2) * 0.05 }}
          >
            <Link href={`/v/${v.slug}#story`} className="pressable card flex overflow-hidden">
              <Photo venue={v} rounded="rounded-none" className="w-[38%] shrink-0" style={{ minHeight: 168 }}>
                <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full serif text-[15px]" style={{ background: "var(--paper)", color: "var(--ink)" }}>
                  {i + 1}
                </span>
              </Photo>
              <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                <div>
                  <p className="eyebrow">
                    {neighborhoodName(v.neighborhood)} · {v.kind === "restaurant" ? "Restaurant" : "Bar"}
                  </p>
                  <h3 className="serif mt-1.5" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
                    {v.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
                    {hook(v)}
                  </p>
                </div>
                <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
                  Read the story →
                </p>
              </div>
            </Link>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/** The first sentence of the story, or the Take if there's no story yet. */
export function hook(v: Venue): string {
  const first = (v.story ?? "").split(/\n\s*\n/)[0]?.trim();
  if (!first) return v.take;
  const m = first.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : first;
}
