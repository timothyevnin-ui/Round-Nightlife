/** What a disagreement is about: the chips on the sheet, and the label in Studio. Shared by client and server. */
export const ABOUTS: { key: string; label: string; prompt: string }[] = [
  { key: "food", label: "The food", prompt: "What's the food actually like?" },
  { key: "crowd", label: "The crowd", prompt: "Who's really in there?" },
  { key: "price", label: "The price", prompt: "What does a night there really cost?" },
  { key: "noise", label: "The noise", prompt: "Louder or quieter than we say?" },
  { key: "line", label: "The line", prompt: "How's getting in, really?" },
  { key: "hours", label: "Hours", prompt: "When is it actually open, or good?" },
  { key: "vibe", label: "The vibe", prompt: "What's the room actually like?" },
  { key: "other", label: "Something else", prompt: "What did we get wrong?" },
];
export const ABOUT_KEYS = ABOUTS.map((a) => a.key);
export function aboutLabel(key: string | undefined): string | undefined {
  return ABOUTS.find((a) => a.key === key)?.label;
}
