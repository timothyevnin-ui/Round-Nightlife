"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { OpenNow } from "./OpenNow";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Ranked } from "@/lib/rank";

/**
 * Ranked by New York (V33): the city's ladder. ROUND's number in tomato, the
 * people's number in green, side by side. On the home page it's the top
 * few with a way into all of them; on /best it's the whole list.
 */
export function CityRank({ rows, raters, title = "Ranked by New York", href, compact = true }: { rows: Ranked[]; raters: number; title?: string; href?: string; compact?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="pt-9" data-city-rank={rows.length}>
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ type: "spring", stiffness: 240, damping: 28 }} className="flex items-baseline justify-between">
        <p className="eyebrow" style={{ color: "var(--pine-bright)" }}>
          {title}
        </p>
        <span className="text-[12px]" style={{ color: "var(--ink-55)" }}>
          {raters > 0 ? `by ${raters} ${raters === 1 ? "person" : "people"}` : "ROUND's scores, until the city votes"}
        </span>
      </motion.div>
      <ol className="mt-1">
        {rows.map((r, i) => (
          <motion.li key={r.venue.slug} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ type: "spring", stiffness: 260, damping: 28, delay: Math.min(i, 4) * 0.04 }} className={i > 0 ? "border-t" : ""} style={{ borderColor: "var(--hairline)" }}>
            <Link href={`/v/${r.venue.slug}`} className="pressable flex items-center gap-3 py-3" data-rank-row={r.venue.slug} data-rank={r.rank}>
              <span className="serif w-6 shrink-0 text-center" style={{ fontSize: r.rank === 1 ? 26 : 22, lineHeight: 1, color: r.rank === 1 ? "var(--tomato)" : "var(--ink-35)" }}>
                {r.rank}
              </span>
              <Photo venue={r.venue} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="serif block truncate" style={{ fontSize: 20, lineHeight: 1.05 }}>
                  {r.venue.name}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11.5px]" style={{ color: "var(--ink-55)" }}>
                  <span className="truncate">{neighborhoodName(r.venue.neighborhood)}</span>
                  <OpenNow hours={r.venue.hours} size={11} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="serif block" style={{ fontSize: 21, lineHeight: 1, color: typeof r.round === "number" ? "var(--tomato-bright)" : "var(--pine-bright)" }}>
                  {typeof r.round === "number" ? r.round : r.people}
                </span>
                <span className="mt-0.5 block text-[10px]" style={{ color: "var(--pine-bright)" }}>
                  {typeof r.round === "number" && typeof r.people === "number" ? `${r.people} · people` : typeof r.round === "number" ? "ROUND" : `${r.n} people`}
                </span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ol>
      {compact && href && (
        <Link href={href} className="pressable mt-3 inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-rank-all>
          All of New York →
        </Link>
      )}
    </section>
  );
}
