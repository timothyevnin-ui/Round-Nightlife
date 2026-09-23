"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { VerifiedMark } from "./VerifiedMark";
import { HoursLine } from "./Hours";
import { ScoreBadge } from "./Score";
import { GoButton, SaveButton, ShareButton } from "./Actions";
import { LabelChip, FriendsChip } from "./VenueCard";
import { neighborhoodName } from "@/lib/neighborhoods";
import { keywordLine } from "@/lib/describe";
import { formatHour } from "@/lib/time";
import type { DatePlan, PickLabel, Venue } from "@/lib/types";

/**
 * One card in the results carousel, kept to what decides a night: the photo,
 * ROUND says, the name, where and what it is, why it's here tonight, the
 * hours, one heads-up, and the buttons. Tap the photo or the name for the
 * full page.
 */

function Says({ venue, size = 18 }: { venue: Venue; size?: number }) {
  return (
    <div data-says className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="eyebrow" style={{ color: "var(--tomato)" }}>
          ROUND says
        </p>
        <p className="serif mt-1" style={{ fontSize: size, lineHeight: 1.3 }}>
          {venue.take}
        </p>
      </div>
      <ScoreBadge score={venue.score} size={46} className="mt-0.5" />
    </div>
  );
}

/** "Day deal · $5 pitchers till 6". Shown whenever there is one; it's the reason to go at 3pm. */
export function DayDeal({ text, className = "mt-2" }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <p className={`flex items-center gap-1.5 text-[13px] ${className}`} style={{ color: "var(--ink-70)" }} data-day-deal>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "#f2c14e" }} aria-hidden>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2.4" fill="var(--ink)" />
          <path d="M6 .8v1.6M6 9.6v1.6M.8 6h1.6M9.6 6h1.6" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-medium" style={{ color: "var(--ink)" }}>
        Day deal
      </span>
      <span>· {text}</span>
    </p>
  );
}

function Catch({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-3 text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }} data-catch>
      <span className="font-semibold" style={{ color: "var(--ink-70)" }}>
        Heads up.
      </span>{" "}
      {text}
    </p>
  );
}

export function ResultCard({ venue, label, why, shareUrl, index = 0 }: { venue: Venue; label: PickLabel; why?: string; shareUrl: string; index?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.05 + Math.min(index, 2) * 0.08 }}
      className="card flex w-[86vw] max-w-[360px] shrink-0 flex-col overflow-hidden"
    >
      <Link href={`/v/${venue.slug}`} className="block">
        <Photo venue={venue} rounded="rounded-none" className="aspect-[16/10] w-full" credit>
          <div className="absolute left-4 top-4">
            <LabelChip label={label} />
          </div>
          <div className="absolute bottom-4 left-4">
            <FriendsChip count={venue.friendsBeen} />
          </div>
        </Photo>
      </Link>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <Link href={`/v/${venue.slug}`} className="block">
          <Says venue={venue} />
          <h2 className="serif mt-4" style={{ fontSize: 27, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
            {venue.name}
            {venue.verified && <VerifiedMark size={20} className="ml-2" />}
          </h2>
          <p className="mt-1 text-[12.5px] font-medium tracking-wide" style={{ color: "var(--ink-55)" }}>
            {keywordLine(venue)}
          </p>
        </Link>

        {why && (
          <p className="mt-3 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }} data-why>
            {why}
          </p>
        )}

        <HoursLine hours={venue.hours} className="mt-3" />
        <DayDeal text={venue.dayDeal} />
        <Catch text={venue.theCatch} />

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          <GoButton venue={venue} className="flex-1" />
          <SaveButton slug={venue.slug} />
          <ShareButton url={shareUrl} title={`${venue.name} — ROUND`} text={`${venue.name}, ${neighborhoodName(venue.neighborhood)}. ${venue.take}`} />
        </div>
      </div>
    </motion.article>
  );
}

/** A two-stop card: dinner, a short walk, drinks. */
export function PlanResultCard({ plan, shareUrl, index = 0, groupWord }: { plan: DatePlan; shareUrl: string; index?: number; groupWord?: string }) {
  const { restaurant, bar } = plan;
  const first = restaurant ?? bar;
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.05 + Math.min(index, 2) * 0.08 }}
      className="card flex w-[86vw] max-w-[360px] shrink-0 flex-col overflow-hidden"
    >
      <Link href={`/v/${first.slug}`} className="block">
        <Photo venue={first} rounded="rounded-none" className="aspect-[16/10] w-full" credit>
          <div className="absolute left-4 top-4">
            <LabelChip label={plan.label} />
          </div>
          {restaurant && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <Photo venue={bar} rounded="rounded-[10px]" className="h-10 w-10" style={{ boxShadow: "0 0 0 2px rgba(246,241,231,0.9)" }} />
              <span className="rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: "rgba(22,33,58,0.55)", color: "var(--on-photo)", backdropFilter: "blur(10px)" }}>
                then {bar.name}
              </span>
            </div>
          )}
        </Photo>
      </Link>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {restaurant ? (
          <>
            <Stop eyebrow={`Dinner · ${formatHour(plan.dinnerAt ?? 20, true)}`} venue={restaurant} big />
            <div className="my-2 flex items-center gap-3">
              <span className="block h-6 w-px" style={{ background: "var(--hairline-strong)", marginLeft: 6 }} />
              <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
                {plan.walkMinutes ?? 5} min walk
              </span>
            </div>
            <Stop eyebrow={`Drinks · ${formatHour(plan.drinksAt, true)}`} venue={bar} />
          </>
        ) : (
          <Link href={`/v/${bar.slug}`} className="block">
            <Says venue={bar} />
            <h2 className="serif mt-4" style={{ fontSize: 27, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
              {bar.name}
              {bar.verified && <VerifiedMark size={20} className="ml-2" />}
            </h2>
            <p className="mt-1 text-[12.5px] font-medium tracking-wide" style={{ color: "var(--ink-55)" }}>
              {keywordLine(bar)}
            </p>
          </Link>
        )}

        {plan.why && (
          <p className="mt-3 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }} data-why>
            {plan.why}
          </p>
        )}

        <HoursLine hours={first.hours} className="mt-3" />
        <DayDeal text={first.dayDeal} />
        <Catch text={first.theCatch} />

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          <GoButton venue={first} className="flex-1" />
          <SaveButton slug={first.slug} />
          <ShareButton
            url={shareUrl}
            title="Tonight — ROUND"
            text={restaurant ? `Dinner at ${restaurant.name}, drinks after at ${bar.name}${groupWord ? ` for ${groupWord}` : ""}.` : `${bar.name}. ${bar.take}`}
          />
        </div>
      </div>
    </motion.article>
  );
}

function Stop({ eyebrow, venue, big }: { eyebrow: string; venue: Venue; big?: boolean }) {
  return (
    <Link href={`/v/${venue.slug}`} className="pressable block">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="serif mt-0.5" style={{ fontSize: big ? 26 : 21, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
        {venue.name}
        {venue.verified && <VerifiedMark size={big ? 18 : 16} className="ml-1.5" />}
      </h3>
      <p className="mt-0.5 text-[12px] font-medium tracking-wide" style={{ color: "var(--ink-55)" }}>
        {keywordLine(venue)}
      </p>
      <p className={`mt-1 ${big ? "" : "line-clamp-2"} text-[13.5px] leading-snug`} style={{ color: "var(--ink-70)" }}>
        <span className="font-semibold" style={{ color: "var(--tomato)" }}>
          ROUND says
        </span>{" "}
        {venue.take}
      </p>
    </Link>
  );
}
