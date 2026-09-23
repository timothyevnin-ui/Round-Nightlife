import { vibeOf, type Venue, type Window } from "./types";
import { formatHour } from "./time";
import { neighborhoodName } from "./neighborhoods";
import { strongAttrLabels } from "./engine";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayRange(days: number[]): string {
  // Group consecutive days (with Sun→Mon wrap) into "Thu–Sat" style ranges.
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every night";
  const groups: number[][] = [];
  for (const d of sorted) {
    const g = groups[groups.length - 1];
    if (g && g[g.length - 1] === d - 1) g.push(d);
    else groups.push([d]);
  }
  // Wrap Saturday→Sunday.
  if (groups.length > 1 && groups[0][0] === 0 && groups[groups.length - 1].slice(-1)[0] === 6) {
    const last = groups.pop()!;
    groups[0] = [...last, ...groups[0]];
  }
  return groups
    .map((g) => (g.length === 1 ? DAY_SHORT[g[0]] : `${DAY_SHORT[g[0]]}–${DAY_SHORT[g[g.length - 1]]}`))
    .join(", ");
}

export function describeWindows(windows: Window[]): string {
  return windows.map((w) => `${dayRange(w.days)} ${formatHour(w.from, true)}–${formatHour(w.to, true)}`).join(" · ");
}

export function bestFor(v: Venue): string[] {
  const out: string[] = [];
  const g = v.groupFit;
  if (g.big >= 0.8) out.push("Big groups");
  else if (g.mid >= 0.85) out.push("Groups of 5–7");
  else if (g.small >= 0.85) out.push("Three or four");
  if (g.two >= 0.9) out.push("Two of you");
  const d = v.dateFit;
  const top = (Object.entries(d) as [keyof typeof d, number][]).sort((a, b) => b[1] - a[1])[0];
  if (top[1] >= 0.85) out.push({ first: "First dates", early: "A few dates in", longterm: "The long game" }[top[0]]);
  const vibe = (Object.entries(vibeOf(v)) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  if (vibe[1] >= 0.8) out.push({ lively: "Lively nights", chill: "Slow nights", talk: "Actual conversation" }[vibe[0]] ?? "");
  return out.filter(Boolean).slice(0, 4);
}

export function priceLabel(p: Venue["price"]) {
  return "$".repeat(p);
}

/** The keywords line on a card: "West Village · Bar · Cheesesteaks · Sports · $$". */
export function keywordLine(v: Venue): string {
  const kind = v.kind === "restaurant" ? "Restaurant" : v.barFood ? "Bar · kitchen" : "Bar";
  const words = [...(v.cuisine ? [v.cuisine] : []), ...(v.tags.length ? v.tags : strongAttrLabels(v, 3))];
  return [neighborhoodName(v.neighborhood), kind, ...[...new Set(words)].slice(0, 3), priceLabel(v.price)].join(" · ");
}
