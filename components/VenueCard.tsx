"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { VerifiedMark } from "./VerifiedMark";
import { HoursLine } from "./Hours";
import { DayDeal } from "./ResultCard";
import { ScoreBadge } from "./Score";
import { keywordLine } from "@/lib/describe";
import { GoButton, SaveButton, ShareButton } from "./Actions";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { PickLabel, Venue } from "@/lib/types";

export function LabelChip({ label }: { label: PickLabel | string }) {
  const isPick = label === "The pick";
  const isSaid = label === "You said";
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold tracking-[0.12em] uppercase"
      style={{
        background: isPick ? "var(--paper)" : isSaid ? "var(--tomato)" : "rgba(22,33,58,0.55)",
        color: isPick ? "var(--ink)" : "var(--on-photo)",
        backdropFilter: "blur(10px)",
        border: isPick ? "none" : "1px solid rgba(246,241,231,0.22)",
      }}
    >
      {label}
    </span>
  );
}

export function FriendsChip({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full pl-2 pr-3 text-[12px] font-medium"
      style={{ background: "rgba(22,33,58,0.55)", backdropFilter: "blur(10px)", border: "1px solid rgba(246,241,231,0.22)", color: "var(--on-photo)" }}
    >
      <span className="flex -space-x-1.5" aria-hidden>
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
          <span key={i} className="h-4 w-4 rounded-full border" style={{ background: ["#e8694a", "#f2c14e", "#2e6b52"][i % 3], borderColor: "#16213a" }} />
        ))}
      </span>
      {count === 1 ? "1 friend has been" : `${count} friends have been`}
    </span>
  );
}

export function VenueCard({
  venue,
  label,
  why,
  shareUrl,
  index = 0,
}: {
  venue: Venue;
  label?: PickLabel;
  why?: string;
  shareUrl: string;
  index?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.05 + index * 0.08 }}
      className="card overflow-hidden"
    >
      <Link href={`/v/${venue.slug}`} className="block">
        <Photo venue={venue} rounded="rounded-none" className="aspect-[4/3] w-full">
          <div className="absolute left-4 top-4">{label && <LabelChip label={label} />}</div>
          <div className="absolute bottom-4 left-4">
            <FriendsChip count={venue.friendsBeen} />
          </div>
        </Photo>
      </Link>

      <div className="px-5 pb-5 pt-4">
        <Link href={`/v/${venue.slug}`} className="block">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow" style={{ color: "var(--tomato)" }}>
                ROUND says
              </p>
              <p className="serif mt-1" style={{ fontSize: 18, lineHeight: 1.3 }}>
                {venue.take}
              </p>
            </div>
            <ScoreBadge score={venue.score} size={46} className="mt-0.5" />
          </div>
          <h2 className="serif mt-4" style={{ fontSize: 27, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
            {venue.name}
            {venue.verified && <VerifiedMark size={20} className="ml-2" />}
          </h2>
          <p className="mt-1 text-[12.5px] font-medium tracking-wide" style={{ color: "var(--chalk-55)" }}>
            {keywordLine(venue)}
          </p>
        </Link>
        {why && (
          <p className="mt-3 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
            {why}
          </p>
        )}
        <HoursLine hours={venue.hours} className="mt-3" />
        <DayDeal text={venue.dayDeal} />
        {venue.theCatch && (
          <p className="mt-3 text-[12.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
            <span className="font-semibold" style={{ color: "var(--chalk-70)" }}>
              Heads up.
            </span>{" "}
            {venue.theCatch}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <GoButton venue={venue} className="flex-1" />
          <SaveButton slug={venue.slug} />
          <ShareButton url={shareUrl} title={`${venue.name} — ROUND`} text={`${venue.name}, ${neighborhoodName(venue.neighborhood)}. ${venue.take}`} />
        </div>
      </div>
    </motion.article>
  );
}
