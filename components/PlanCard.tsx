"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { VerifiedMark } from "./VerifiedMark";
import { GoButton, SaveButton, ShareButton } from "./Actions";
import { LabelChip } from "./VenueCard";
import { neighborhoodName } from "@/lib/neighborhoods";
import { formatHour } from "@/lib/time";
import type { DatePlan } from "@/lib/types";

/** A two-stop evening: dinner, a short walk, drinks. */
export function PlanCard({ plan, shareUrl, index = 0 }: { plan: DatePlan; shareUrl: string; index?: number }) {
  const { restaurant, bar } = plan;
  const first = restaurant ?? bar;
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.05 + index * 0.08 }}
      className="card overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <LabelChip label={plan.label} />
        <span className="text-[12px] font-medium" style={{ color: "var(--chalk-55)" }}>
          {neighborhoodName(first.neighborhood)}
        </span>
      </div>

      <div className="px-5 pt-4">
        {restaurant && (
          <Stop
            eyebrow={`Dinner · ${formatHour(plan.dinnerAt ?? 20, true)}`}
            venue={restaurant}
          />
        )}
        {restaurant && (
          <div className="ml-[35px] flex items-center gap-3 py-1.5">
            <span className="block h-8 w-px" style={{ background: "var(--hairline-strong)" }} />
            <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
              {plan.walkMinutes ?? 5} min walk
            </span>
          </div>
        )}
        <Stop eyebrow={`Drinks · ${formatHour(plan.drinksAt, true)}`} venue={bar} />
      </div>

      <div className="px-5 pb-5 pt-4">
        <p className="text-[12.5px] font-medium tracking-wide" style={{ color: "var(--chalk-55)" }}>
          {plan.why}
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <GoButton venue={first} className="flex-1" />
          <SaveButton slug={first.slug} />
          <ShareButton
            url={shareUrl}
            title="Tonight — ROUND"
            text={restaurant ? `Dinner at ${restaurant.name}, drinks after at ${bar.name}.` : `${bar.name}. ${bar.take}`}
          />
        </div>
      </div>
    </motion.article>
  );
}

function Stop({ eyebrow, venue }: { eyebrow: string; venue: DatePlan["bar"] }) {
  return (
    <Link href={`/v/${venue.slug}`} className="pressable flex items-center gap-4">
      <Photo venue={venue} rounded="rounded-[16px]" className="h-[70px] w-[70px] shrink-0" />
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="serif mt-0.5 truncate" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
          {venue.name}
          {venue.verified && <VerifiedMark size={17} className="ml-1.5" />}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
          {venue.take}
        </p>
      </div>
    </Link>
  );
}
