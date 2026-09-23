"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "./Photo";
import { GoButton, SaveButton, ShareButton } from "./Actions";
import { LabelChip, FriendsChip } from "./VenueCard";
import { neighborhoodName } from "@/lib/neighborhoods";
import { bestFor, describeWindows, priceLabel } from "@/lib/describe";
import { formatHour } from "@/lib/time";
import type { DatePlan, PickLabel, Venue } from "@/lib/types";

/**
 * One card in the results carousel: the photo, the label, and everything you
 * need to decide without leaving the screen. Tap the photo or the name for the
 * full page (the story, the address, the map).
 */

const ROOM = { tiny: "Tiny room", small: "Small room", medium: "Medium room", large: "Big room" } as const;

function easyInLabel(e: number) {
  if (e >= 0.8) return "Walk right in";
  if (e >= 0.55) return "Usually fine";
  if (e >= 0.35) return "Can be a wait";
  return "Line at peak";
}

function Facts({ venue }: { venue: Venue }) {
  const facts = [
    ["Price", priceLabel(venue.price)],
    ["Room", ROOM[venue.capacity]],
    ["Getting in", easyInLabel(venue.easyIn)],
    ["Best time", describeWindows(venue.bestWindows).split(" · ")[0]],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-0.5 truncate text-[13.5px]" style={{ color: "var(--ink-70)" }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ResultCard({ venue, label, why, shareUrl, index = 0 }: { venue: Venue; label: PickLabel; why?: string; shareUrl: string; index?: number }) {
  const best = bestFor(venue);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.05 + Math.min(index, 2) * 0.08 }}
      className="card flex w-[86vw] max-w-[360px] shrink-0 flex-col overflow-hidden"
    >
      <Link href={`/v/${venue.slug}`} className="block">
        <Photo venue={venue} rounded="rounded-none" className="aspect-[16/10] w-full">
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
          <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
            {venue.name}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }}>
            {neighborhoodName(venue.neighborhood)} · {venue.tags.slice(0, 3).join(" · ")}
          </p>
          <p className="mt-3 text-[15px] leading-[1.45]" style={{ color: "var(--ink-70)" }}>
            {venue.take}
          </p>
        </Link>

        {venue.theCatch && (
          <p className="mt-3 rounded-[14px] px-3.5 py-2.5 text-[13px] leading-snug" style={{ background: "var(--ink-6)", color: "var(--ink-70)" }}>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              The catch.
            </span>{" "}
            {venue.theCatch}
          </p>
        )}

        <Facts venue={venue} />

        {(why || best.length > 0) && (
          <p className="mt-4 text-[12.5px] font-medium tracking-wide" style={{ color: "var(--ink-55)" }}>
            {why || best.join(" · ")}
          </p>
        )}

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
        <Photo venue={first} rounded="rounded-none" className="aspect-[16/10] w-full">
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
            <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
              {bar.name}
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }}>
              {neighborhoodName(bar.neighborhood)} · {bar.tags.slice(0, 3).join(" · ")}
            </p>
            <p className="mt-3 text-[15px] leading-[1.45]" style={{ color: "var(--ink-70)" }}>
              {bar.take}
            </p>
          </Link>
        )}

        {first.theCatch && (
          <p className="mt-3 rounded-[14px] px-3.5 py-2.5 text-[13px] leading-snug" style={{ background: "var(--ink-6)", color: "var(--ink-70)" }}>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              The catch.
            </span>{" "}
            {first.theCatch}
          </p>
        )}

        <Facts venue={first} />

        <p className="mt-4 text-[12.5px] font-medium tracking-wide" style={{ color: "var(--ink-55)" }}>
          {plan.why}
        </p>

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
      </h3>
      <p className={`mt-0.5 ${big ? "" : "line-clamp-2"} text-[13.5px] leading-snug`} style={{ color: "var(--ink-70)" }}>
        {venue.take}
      </p>
    </Link>
  );
}
