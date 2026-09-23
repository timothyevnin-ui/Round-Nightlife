import type { DayHours, Hours } from "./types";

/** Seven entries of {open, close} or null; anything else is "unknown". */
export function cleanHours(x: unknown): Hours | undefined {
  if (!Array.isArray(x) || x.length !== 7) return undefined;
  const ok = (t: unknown) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const out = x.map((d) => (d && typeof d === "object" && ok((d as { open?: unknown }).open) && ok((d as { close?: unknown }).close) ? { open: (d as { open: string }).open, close: (d as { close: string }).close } : null));
  return out.every((d) => d === null) ? undefined : (out as Hours);
}


/**
 * Posted hours, the way a night out reads them: "tonight" starts on the
 * calendar day and runs past midnight, so at 1am on a Saturday you're still
 * looking at Friday's hours.
 */

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "18:00" → 18, "02:30" → 2.5 */
export function toDecimal(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** 18 → "6pm", 2.5 → "2:30am", 0 → "12am", 12 → "12pm" */
export function fmt(t: string): string {
  const d = toDecimal(t) % 24;
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** "6pm–2am" or "Closed". */
export function rangeWord(d: DayHours): string {
  if (!d) return "Closed";
  return `${fmt(d.open)}–${fmt(d.close)}`;
}

/** The weekday (0 = Sunday) that "tonight" belongs to in New York, at a given moment. */
export function nightDayIndex(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12") % 24;
  let day = DAY_SHORT.indexOf(wd);
  if (day < 0) day = 0;
  if (hour < 5) day = (day + 6) % 7; // small hours belong to last night
  return day;
}

/** Is the place open at this moment (New York time)? null when hours are unknown. */
export function openNow(hours: Hours | undefined, now = new Date()): boolean | null {
  if (!hours) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const wd = DAY_SHORT.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
  const t = (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) + Number(parts.find((p) => p.type === "minute")?.value ?? 0) / 60;
  const within = (d: DayHours, tt: number) => {
    if (!d) return false;
    const o = toDecimal(d.open);
    let c = toDecimal(d.close);
    if (c <= o) c += 24;
    return tt >= o && tt < c;
  };
  // Today's hours, or yesterday's running past midnight.
  return within(hours[wd], t) || within(hours[(wd + 6) % 7], t + 24);
}

/** Group identical consecutive days: "Mon–Thu 5pm–2am · Fri–Sat 5pm–4am · Sun Closed". */
export function weekSummary(hours: Hours): string {
  const out: string[] = [];
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  let k = 0;
  while (k < order.length) {
    const start = order[k];
    const word = rangeWord(hours[start]);
    let end = start;
    let j = k + 1;
    while (j < order.length && rangeWord(hours[order[j]]) === word) {
      end = order[j];
      j++;
    }
    out.push(`${start === end ? DAY_SHORT[start] : `${DAY_SHORT[start]}–${DAY_SHORT[end]}`} ${word}`);
    k = j;
  }
  return out.join(" · ");
}

/** The same hours every day, from one range. */
export function everyDay(open: string, close: string): Hours {
  const d = { open, close };
  return [d, d, d, d, d, d, d];
}
