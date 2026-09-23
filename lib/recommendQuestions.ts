import type { Attrs } from "./types";
import type { SuggestionAnswers } from "./suggestions";

/**
 * The quick ones someone answers about a place they're recommending. Same
 * feel as the app's own questions (typed out, two or three buttons), but
 * these describe the place instead of the night. Each answer nudges the
 * draft that lands in the back office; Tim still decides.
 */

export type RecOption = {
  label: string;
  attrs?: Partial<Attrs>;
  price?: 1 | 2 | 3 | 4;
  easyIn?: number;
  groupBig?: number;
  dateFit?: number;
  capacity?: "tiny" | "small" | "medium" | "large";
};

export type RecQuestion = { id: string; prompt: string; short: string; options: RecOption[] };

export const REC_QUESTIONS: RecQuestion[] = [
  { id: "dance", prompt: "Do people dance there?", short: "Dance", options: [{ label: "Yes", attrs: { dance: 1, lively: 0.7 } }, { label: "No", attrs: { dance: 0 } }] },
  { id: "loud", prompt: "Loud or not?", short: "Loud", options: [{ label: "Loud", attrs: { lively: 1 } }, { label: "Not loud", attrs: { talk: 1, chill: 0.6 } }] },
  { id: "seat", prompt: "Can you get a seat?", short: "Seat", options: [{ label: "Usually", attrs: { seating: 1 } }, { label: "Good luck", attrs: { seating: 0 } }] },
  { id: "line", prompt: "Is there a line?", short: "Line", options: [{ label: "Always", easyIn: 0.15 }, { label: "Sometimes", easyIn: 0.5 }, { label: "Never", easyIn: 0.85 }] },
  { id: "price", prompt: "What's a drink run you?", short: "Drinks", options: [{ label: "$", price: 1, attrs: { cheap: 1 } }, { label: "$$", price: 2 }, { label: "$$$", price: 3, attrs: { upscale: 0.7 } }] },
  { id: "outside", prompt: "Any outside space?", short: "Outside", options: [{ label: "Yes", attrs: { outdoor: 1 } }, { label: "No", attrs: { outdoor: 0 } }] },
  { id: "late", prompt: "Still going at 2am?", short: "2am", options: [{ label: "Yes", attrs: { late: 1 } }, { label: "No", attrs: { late: 0 } }] },
  { id: "food", prompt: "Real food?", short: "Food", options: [{ label: "Yes", attrs: { food: 1 } }, { label: "Snacks", attrs: { food: 0.5 } }, { label: "No", attrs: { food: 0 } }] },
  { id: "vibe", prompt: "Dive or nice?", short: "Vibe", options: [{ label: "Dive", attrs: { dive: 1 } }, { label: "Between", attrs: { dive: 0.4, upscale: 0.4 } }, { label: "Nice", attrs: { upscale: 1 } }] },
  { id: "drink", prompt: "Cocktails or beers?", short: "Drink", options: [{ label: "Cocktails", attrs: { cocktails: 1 } }, { label: "Both", attrs: { cocktails: 0.7, beer: 0.7 } }, { label: "Beers", attrs: { beer: 1 } }] },
  { id: "date", prompt: "Would you take a date?", short: "Date", options: [{ label: "Yes", attrs: { date: 1 }, dateFit: 0.85 }, { label: "No", attrs: { date: 0 }, dateFit: 0.2 }] },
  { id: "group", prompt: "Eight of you, fine?", short: "Big group", options: [{ label: "Yes", attrs: { groups: 1 }, groupBig: 0.85 }, { label: "No", attrs: { groups: 0 }, groupBig: 0.15 }] },
];

/** The restaurant set: what decides a dinner, not a bar. */
export const REC_QUESTIONS_RESTAURANT: RecQuestion[] = [
  { id: "resy", prompt: "Do you need a reservation?", short: "Resy", options: [{ label: "Always", easyIn: 0.15 }, { label: "It helps", easyIn: 0.5 }, { label: "Walk in", easyIn: 0.85 }] },
  { id: "noise", prompt: "Can you hear each other?", short: "Noise", options: [{ label: "Yes", attrs: { talk: 1, chill: 0.5 } }, { label: "It's loud", attrs: { lively: 1, talk: 0.1 } }] },
  { id: "plates", prompt: "Shared plates or your own?", short: "Plates", options: [{ label: "Shared", attrs: { groups: 0.8, social: 0.4, food: 1 } }, { label: "Your own", attrs: { food: 1 } }] },
  { id: "perhead", prompt: "Dinner per person, roughly?", short: "Per head", options: [{ label: "Under $40", price: 1, attrs: { cheap: 1 } }, { label: "$40–80", price: 2 }, { label: "$80–150", price: 3, attrs: { upscale: 0.7 } }, { label: "Sky's the limit", price: 4, attrs: { upscale: 1, dressy: 0.6 } }] },
  { id: "bar", prompt: "Is there a real bar to drink at?", short: "Bar", options: [{ label: "Yes", attrs: { cocktails: 0.7, social: 0.4 } }, { label: "Not really", attrs: { cocktails: 0.2 } }] },
  { id: "kitchen", prompt: "Kitchen open late?", short: "Late kitchen", options: [{ label: "Past midnight", attrs: { late: 1 } }, { label: "Closes by 11", attrs: { late: 0.1 } }] },
  { id: "dateish", prompt: "Date night material?", short: "Date", options: [{ label: "Yes", attrs: { date: 1 }, dateFit: 0.85 }, { label: "More of a group place", attrs: { date: 0.3, groups: 0.8 }, groupBig: 0.85 }] },
  { id: "pour", prompt: "Wine list or cocktails?", short: "Pour", options: [{ label: "Wine", attrs: { wine: 1 } }, { label: "Cocktails", attrs: { cocktails: 1 } }, { label: "Both", attrs: { wine: 0.7, cocktails: 0.7 } }] },
  { id: "bougie", prompt: "Bougie or chill?", short: "Bougie", options: [{ label: "Bougie", attrs: { upscale: 1, scene: 0.5, dressy: 0.7 } }, { label: "Chill", attrs: { chill: 1, upscale: 0.1, dressy: 0.1 } }] },
  { id: "eight", prompt: "Can eight of you sit together?", short: "Big table", options: [{ label: "Yes", attrs: { groups: 1 }, groupBig: 0.85, capacity: "large" }, { label: "No", attrs: { groups: 0.1 }, groupBig: 0.15 }] },
  { id: "outsidep", prompt: "Outside seating?", short: "Outside", options: [{ label: "Yes", attrs: { outdoor: 1 } }, { label: "No", attrs: { outdoor: 0 } }] },
];

/** The right bank for the kind of place. */
export function questionsFor(kind: "bar" | "restaurant"): RecQuestion[] {
  return kind === "restaurant" ? REC_QUESTIONS_RESTAURANT : REC_QUESTIONS;
}

/** "Do people dance there? Yes" → { short: "Dance", answer: "Yes" } (for the inbox chips). */
export function describeSaid(said: string): { short: string; answer: string } {
  const i = said.lastIndexOf("? ");
  const prompt = i > 0 ? said.slice(0, i + 1) : said;
  const answer = i > 0 ? said.slice(i + 2) : "";
  const q = [...REC_QUESTIONS, ...REC_QUESTIONS_RESTAURANT].find((x) => x.prompt === prompt);
  return { short: q?.short ?? prompt.replace(/\?$/, "").slice(0, 18), answer };
}

export function applyRecAnswer(a: SuggestionAnswers, q: RecQuestion, k: number): SuggestionAnswers {
  const o = q.options[k];
  if (!o) return a;
  const next: SuggestionAnswers = { ...a, attrs: { ...(a.attrs ?? {}), ...(o.attrs ?? {}) }, said: [...(a.said ?? []), `${q.prompt} ${o.label}`] };
  if (o.price) next.price = o.price;
  if (typeof o.easyIn === "number") next.easyIn = o.easyIn;
  if (typeof o.groupBig === "number") next.groupBig = o.groupBig;
  if (typeof o.dateFit === "number") next.dateFit = o.dateFit;
  if (o.capacity) next.capacity = o.capacity;
  return next;
}
