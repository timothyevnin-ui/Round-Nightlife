/**
 * The typed questions. ROUND learns from words, so both the public recommend
 * flow and the Studio's Add a place ask the same five things and let the
 * person answer in sentences; the AI reads the answers into the fields.
 * Nothing here is a button: two choices never taught anyone anything.
 */
export type Ask = {
  key: "pitch" | "room" | "order" | "when" | "who";
  prompt: string;
  hint: string;
  placeholder: string;
  /** The first one is the pitch; without it there's nothing to read. */
  required?: boolean;
};

export const ASKS: Ask[] = [
  {
    key: "pitch",
    prompt: "Why should it be on ROUND?",
    hint: "The one thing you'd tell a friend who asked.",
    placeholder: "Best Guinness pour in the Village, and the back room on a Sunday is the whole reason to live here…",
    required: true,
  },
  {
    key: "room",
    prompt: "What's the room like on a good night?",
    hint: "Loud or quiet, who's actually there, what it feels like at eleven.",
    placeholder: "Packed by 10, mostly people who live nearby, you can still hear yourself until the DJ starts…",
  },
  {
    key: "order",
    prompt: "What do you order, and what does it run you?",
    hint: "Drinks, food if there is any, the damage.",
    placeholder: "$8 pints, the wings are actually good, two rounds and wings was about $50 for two of us…",
  },
  {
    key: "when",
    prompt: "When do you go, and how's getting in?",
    hint: "The night, the hour, the line, the door.",
    placeholder: "Thursdays after work; no line before 9, Saturdays there's a 20-minute wait and a bouncer who doesn't care…",
  },
  {
    key: "who",
    prompt: "Who is it for?",
    hint: "A date, the whole group, alone at the bar, the game, a birthday.",
    placeholder: "Six of us fit no problem. Wouldn't bring a first date; perfect for the third…",
  },
];

/** The answers as one block of text, question by question, for the AI and the notes. */
export function asksToText(words: Partial<Record<Ask["key"], string>> | undefined): string {
  if (!words) return "";
  return ASKS.map((a) => {
    const v = (words[a.key] ?? "").trim();
    return v ? `${a.prompt} ${v}` : "";
  })
    .filter(Boolean)
    .join("\n");
}
