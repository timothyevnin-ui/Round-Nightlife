"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toResultsParams, type Interpretation } from "@/lib/interpret";
import { nightWhen } from "@/lib/when";
import { useRoundStore } from "@/lib/store";

const EXAMPLES = [
  "Six of us in the West Village, want to dance but not a club, no line",
  "First date in Williamsburg, quiet, low light, around 9",
  "Cheap dive in the East Village where we can watch the game",
  "Rooftop in Brooklyn for four, a little bougie, cocktails",
];

/** "Just say it" — a sentence in, the same three places out. */
export function SayIt() {
  const router = useRouter();
  const { state } = useRoundStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState<string[] | null>(null);
  const [example] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);

  const go = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const json = (await res.json()) as { interpretation?: Interpretation };
      const i = json.interpretation;
      if (!i) throw new Error("no interpretation");
      setUnderstood(i.understood);
      // No time in the sentence means tonight: 9 while it's still daytime, now in the evening.
      const w = nightWhen();
      if (i.hour === undefined) i.hour = w.hour;
      const params = toResultsParams(i, w.dow, text);
      if ((i.wants.new ?? 0) > 0) {
        const been = Object.keys(state.been);
        if (been.length) params.set("b", been.join(","));
      }
      window.setTimeout(() => router.push(`/results?${params.toString()}`), 350);
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pressable flex w-full items-center gap-3 rounded-full border px-4 text-left"
        style={{ height: 52, borderColor: "var(--hairline-strong)", background: "rgba(22,33,58,0.04)" }}
        aria-label="Just say what kind of night"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(22,33,58,0.1)" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 11.5l1-3.5L9.5 1.5l2.5 2.5L5.5 10.5 2 11.5Z" stroke="#16213A" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="truncate text-[14px]" style={{ color: "var(--chalk-55)" }}>
          Or just say it…
        </span>
      </button>

      {/* Portaled to the body: the hero above is transformed while it scrolls, which would trap a fixed sheet and let the page bleed through it. */}
      {typeof document !== "undefined" &&
        createPortal(
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={() => !busy && setOpen(false)} data-sayit-sheet>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-[28px] border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--chalk-20)" }} />
              <p className="eyebrow">Just say it</p>
              <h2 className="serif mt-1" style={{ fontSize: 28, lineHeight: 1.05 }}>
                What kind of night?
              </h2>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    go();
                  }
                }}
                placeholder="Type it like you'd text a friend…"
                rows={3}
                maxLength={400}
                className="mt-4 w-full resize-none rounded-[18px] border p-4 text-[16px] leading-snug outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" }}
                data-sayit-input
              />
              {!text && (
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--chalk-35)" }}>
                  Like: &ldquo;{example}&rdquo;
                </p>
              )}
              <AnimatePresence>
                {understood && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-[13px]" style={{ color: "var(--chalk-55)" }}>
                    Got it: {understood.join(" · ")}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="mt-4 flex items-center gap-2.5">
                <button onClick={go} disabled={busy || !text.trim()} className="pressable btn-primary flex h-14 flex-1 items-center justify-center text-[16px]" style={{ opacity: busy || !text.trim() ? 0.6 : 1 }}>
                  {busy ? "Thinking…" : "Show me"}
                </button>
                <button onClick={() => setOpen(false)} disabled={busy} className="pressable btn-ghost flex h-14 items-center px-5 text-[14px]">
                  Cancel
                </button>
              </div>
              <p className="mt-3 text-[12px]" style={{ color: "var(--chalk-35)" }}>
                Neighborhood, how many, when, and anything you care about: dancing, sitting, the game, no line.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
