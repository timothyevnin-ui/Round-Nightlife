"use client";

import { useSyncExternalStore } from "react";
import { closesAt, fmtHour, nowInNewYork, openWord } from "@/lib/hours";
import type { Hours } from "@/lib/types";

const noop = () => () => {};

/**
 * The live dot (V33): "Open till 4am", "Closes in 40 min", "Opens 5pm",
 * "Closed tonight", from the phone's clock in New York time. Nothing when
 * hours aren't known, and nothing on the server (the clock is the phone's).
 */
export function OpenNow({ hours, className = "", size = 11.5 }: { hours?: Hours; className?: string; size?: number }) {
  const key = useSyncExternalStore(noop, () => {
    const { hour, dow } = nowInNewYork();
    return `${dow}:${Math.round(hour * 12) / 12}`; // five-minute ticks, so a new word appears as it closes in
  }, () => "");
  if (!hours || !key) return null;
  const [dowS, hourS] = key.split(":");
  const dow = Number(dowS);
  const hour = Number(hourS);
  const w = openWord(hours, dow, hour);
  if (!w) return null;
  let text = w.text;
  if (w.state === "open") {
    const close = closesAt(hours, dow, hour);
    const minutes = close !== null ? Math.round((close - hour) * 60) : null;
    if (minutes !== null && minutes <= 60) text = minutes <= 5 ? "Last call" : `Closes in ${minutes} min`;
    else if (close !== null) text = `Open till ${fmtHour(close)}`;
  }
  const tone = w.state === "open" ? "var(--pine-bright)" : w.state === "later" ? "var(--butter)" : "var(--ink-35)";
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${className}`} style={{ fontSize: size, color: w.state === "closed" ? "var(--ink-45)" : "var(--ink-70)" }} data-open-now={w.state}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone, boxShadow: w.state === "open" ? `0 0 0 3px color-mix(in srgb, ${tone} 25%, transparent)` : undefined }} aria-hidden />
      {text}
    </span>
  );
}
