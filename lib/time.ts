/** Time helpers — everything ROUND guesses about "tonight" lives here. */

export const NYC_TZ = "America/New_York";

export function nowInNYC(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NYC_TZ,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { hour, minute, dow: dow < 0 ? date.getDay() : dow };
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "It's Thursday night." / "It's Saturday." — the greeting on Home. */
export function greeting(date = new Date()) {
  const { hour, dow } = nowInNYC(date);
  // After midnight still counts as the previous night.
  const nightDow = hour < 5 ? (dow + 6) % 7 : dow;
  const day = DAY_NAMES[nightDow];
  if (hour >= 17 || hour < 5) return `It's ${day} night.`;
  if (hour >= 12) return `It's ${day} afternoon.`;
  return `It's ${day}.`;
}

/**
 * Time options for the flow. "Now" is only offered in the evening; otherwise the
 * default is 9. Values are hours in 24h (24+ = after midnight).
 */
export type TimeOption = { value: number; label: string; sub?: string };

export function timeOptions(date = new Date()): { options: TimeOption[]; defaultValue: number; dow: number } {
  const { hour, minute, dow } = nowInNYC(date);
  const evening = hour >= 17 || hour < 3;
  const nowValue = hour < 3 ? hour + 24 + minute / 60 : hour + minute / 60;
  const base: TimeOption[] = [
    { value: 20, label: "8" },
    { value: 21, label: "9" },
    { value: 22, label: "10" },
    { value: 23, label: "11" },
    { value: 24.5, label: "Later" },
  ];
  const options = evening ? [{ value: roundToQuarter(nowValue), label: "Now" }, ...base] : base;
  // Default: Now in the evening; 9 otherwise.
  const defaultValue = evening ? options[0].value : 21;
  // Which night? After midnight, the night belongs to yesterday's day-of-week.
  const nightDow = hour < 5 ? (dow + 6) % 7 : dow;
  return { options, defaultValue, dow: nightDow };
}

function roundToQuarter(h: number) {
  return Math.round(h * 4) / 4;
}

/** 21.75 → "9:45", 24.5 → "12:30", 22 → "10" */
export function formatHour(h: number, withSuffix = false) {
  const total = ((h % 24) + 24) % 24;
  const hours = Math.floor(total);
  const mins = Math.round((total - hours) * 60);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const suffix = hours >= 12 ? "pm" : "am";
  const m = mins === 0 ? "" : `:${String(mins).padStart(2, "0")}`;
  return withSuffix ? `${h12}${m}${suffix}` : `${h12}${m}`;
}

/**
 * The meal a plan's first stop is, by the clock: before 10 it's breakfast;
 * 10 to 4 is brunch on a Friday, Saturday or Sunday and lunch the other days;
 * from 4 it's dinner. So a 1pm plan never says "Dinner".
 */
export function mealWord(hour: number, dow?: number): "Breakfast" | "Brunch" | "Lunch" | "Dinner" {
  const h = ((hour % 24) + 24) % 24;
  if (h < 10 && h >= 5) return "Breakfast";
  if (h >= 10 && h < 16) return dow === undefined || dow === 0 || dow === 5 || dow === 6 ? "Brunch" : "Lunch";
  return "Dinner";
}
