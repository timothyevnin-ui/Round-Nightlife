"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { OpenNow } from "./OpenNow";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

/**
 * What's hot (V33): the blog, under the ask. Big photo cards you swipe
 * through, each a place ROUND went, the day stamped on the photo, the score,
 * the first line of the story, Read the story. Written in the back office.
 */
export function HotShelf({ venues, compact = false }: { venues: Venue[]; compact?: boolean }) {
  // The phone's clock, read once: the day stamp is relative to now.
  const [now] = useState(() => Date.now());
  if (!venues.length) return null;
  return (
    <section id="hot" className="scroll-mt-4 pt-9" data-hot-shelf={venues.length}>
      <motion.header initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ type: "spring", stiffness: 240, damping: 28 }} className="flex items-baseline justify-between">
        <p className="eyebrow" style={{ color: "var(--tomato-bright)" }}>
          What&apos;s hot
        </p>
        <Link href="/hot" className="pressable text-[12.5px]" style={{ color: "var(--ink-55)" }}>
          {compact ? "All of them" : "ROUND went this week"}
        </Link>
      </motion.header>

      <div className="no-scrollbar snap-x -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollPaddingLeft: 20, scrollPaddingRight: 20 }}>
        {venues.map((v, i) => (
          <motion.article
            key={v.slug}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: "spring", stiffness: 240, damping: 28, delay: Math.min(i, 2) * 0.06 }}
            className="w-[78vw] max-w-[320px] shrink-0 overflow-hidden rounded-[22px]"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
            data-hot-card={v.slug}
          >
            <Link href={`/v/${v.slug}#story`} className="pressable block">
              <Photo venue={v} rounded="rounded-none" className="aspect-[3/2] w-full">
                <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,23,48,0) 55%, rgba(14,23,48,0.8) 100%)" }} />
                {v.visitedAt && (
                  <span className="absolute left-3.5 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: "var(--tomato)", color: "var(--on-photo)" }} data-visited>
                    {dayWord(v.visitedAt, now)}
                  </span>
                )}
              </Photo>
              <div className="px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="serif truncate" style={{ fontSize: 24, lineHeight: 1, letterSpacing: "-0.015em" }}>
                      {v.name}
                    </h3>
                    <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--ink-55)" }}>
                      {neighborhoodName(v.neighborhood)}
                      {v.tags[0] ? ` · ${v.tags[0]}` : ""}
                    </p>
                  </div>
                  {typeof v.score === "number" && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold" style={{ borderColor: "var(--tomato)", color: "var(--tomato-bright)" }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--tomato)" }} aria-hidden />
                      {v.score}
                    </span>
                  )}
                </div>
                <p className="serif mt-2.5 line-clamp-2" style={{ fontSize: 16, lineHeight: 1.25, color: "var(--ink-85)" }}>
                  {hook(v)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--tomato-bright)" }}>
                    Read the story →
                  </span>
                  <OpenNow hours={v.hours} />
                </div>
              </div>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

/** "Thursday" inside two weeks, "Sep 29" after, nothing without a date. */
export function dayWord(iso: string, now: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const days = (now - d.getTime()) / 864e5;
  if (days < 1 && days > -1) return "Today";
  if (days < 14) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The first sentence of the story, or the Take if there's no story yet. */
export function hook(v: Venue): string {
  const first = (v.story ?? "").split(/\n\s*\n/)[0]?.trim();
  if (!first) return v.take;
  const m = first.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : first;
}
