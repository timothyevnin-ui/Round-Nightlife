"use client";

import { useState, useSyncExternalStore } from "react";
import { DAY_LONG, DAY_SHORT, nightDayIndex, openNow, rangeWord } from "@/lib/hours";
import type { Hours } from "@/lib/types";

const noop = () => () => {};

/** "Tonight 6pm–2am" (tap for the week). Nothing at all when hours aren't known. */
export function HoursLine({ hours, expandable = true, className = "" }: { hours?: Hours; expandable?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  // The server doesn't know the phone's clock; render tonight on the client only.
  const day = useSyncExternalStore(noop, () => nightDayIndex(), () => -1);
  if (!hours) return null;
  const isOpen = day >= 0 ? openNow(hours) : null;
  const tonight = day >= 0 ? rangeWord(hours[day]) : "";
  return (
    <div className={className} data-hours>
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex items-center gap-2 text-left text-[13.5px] ${expandable ? "pressable" : ""}`}
        style={{ color: "var(--ink-70)" }}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: isOpen === null ? "var(--ink-20)" : isOpen ? "var(--pine)" : "var(--ink-35)" }} aria-hidden />
        <span>
          <span className="font-medium" style={{ color: "var(--ink)" }}>
            {day < 0 ? "Hours" : tonight === "Closed" ? "Closed tonight" : `Tonight ${tonight}`}
          </span>
          {isOpen === true && (
            <span className="ml-1.5" style={{ color: "var(--pine)" }}>
              · Open now
            </span>
          )}
        </span>
        {expandable && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms" }}>
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && <HoursWeek hours={hours} today={day} className="mt-2" />}
    </div>
  );
}

/** The full week, tonight highlighted. */
export function HoursWeek({ hours, today, className = "" }: { hours: Hours; today?: number; className?: string }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] ${className}`} aria-label="Hours">
      {order.map((d) => (
        <div key={d} className="contents">
          <dt className="font-medium" style={{ color: d === today ? "var(--ink)" : "var(--ink-55)" }} aria-label={DAY_LONG[d]}>
            {DAY_SHORT[d]}
          </dt>
          <dd style={{ color: d === today ? "var(--ink)" : "var(--ink-55)", fontWeight: d === today ? 500 : 400 }}>{rangeWord(hours[d])}</dd>
        </div>
      ))}
    </dl>
  );
}
