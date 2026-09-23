"use client";

import { nowInNYC, timeOptions } from "./time";

/**
 * When. There's no time picker on Home any more (it complicated things): the
 * phone's clock decides, and each door starts from a sensible default.
 * Night out and Just say it mean tonight; the day door means this afternoon.
 */

/** Right now, in ROUND's terms: hour (24+ after midnight) and the night's day-of-week. */
export function nowWhen(): { hour: number; dow: number } {
  const { hour, minute, dow } = nowInNYC();
  const h = hour < 5 ? hour + 24 + minute / 60 : hour + minute / 60;
  return { hour: Math.round(h * 4) / 4, dow: hour < 5 ? (dow + 6) % 7 : dow };
}

/** What a night starts from: now in the evening, 9pm when it's still daytime. */
export function nightWhen(): { hour: number; dow: number } {
  const { defaultValue, dow } = timeOptions();
  return { hour: defaultValue, dow };
}

/**
 * What a day out starts from: now while it's daytime, 12:30 if it's early,
 * and tomorrow at 1pm if the day is already over.
 */
export function dayWhen(): { hour: number; dow: number } {
  const now = nowWhen();
  if (now.hour < 11) return { hour: 12.5, dow: now.dow };
  if (now.hour < 18.5) return now;
  return { hour: 13, dow: (now.dow + 1) % 7 };
}

export const isDayHour = (h: number) => h >= 5 && h < 17;
