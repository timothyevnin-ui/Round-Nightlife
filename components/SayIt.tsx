"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toResultsParams, type Interpretation } from "@/lib/interpret";
import { locate } from "@/lib/locate";
import { formatMe } from "@/lib/where";
import { neighborhoodName } from "@/lib/neighborhoods";
import { formatHour } from "@/lib/time";
import { nightWhen } from "@/lib/when";
import { useRoundStore } from "@/lib/store";

const EXAMPLES = [
  "Six of us in the West Village, want to dance but not a club, no line",
  "First date in Tribeca, quiet, low light, around 9",
  "Cheap dive in the East Village where we can watch the game",
  "Rooftop in Chelsea for four, a little bougie, cocktails",
  "Somewhere near Bleecker I can actually hear my friends",
  "Dinner then drinks on the Lower East Side, Thursday, eight of us",
  "Bars near Rubirosa, we're getting out of dinner at 10",
];

/**
 * "Just say it." The front door. Tap the pill and the whole screen goes dark:
 * one big box, examples drifting through it until you type, and under the box
 * ROUND says what it's hearing as you go: the neighborhood, the hour, how
 * many, what you care about. Then Show me, and the same picks as any door.
 */
export function SayIt() {
  const router = useRouter();
  const { state } = useRoundStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // What ROUND heard, and for which text; while the text has moved on, the dot pulses and the old chips stay until the new ones land.
  const [heardFor, setHeardFor] = useState<{ q: string; chips: string[] }>({ q: "", chips: [] });
  const q = text.trim();
  const heard = q.length >= 6 ? heardFor.chips : [];
  const listening = q.length >= 6 && heardFor.q !== q;
  const [exampleAt, setExampleAt] = useState(() => Math.floor(Math.random() * EXAMPLES.length));
  const box = useRef<HTMLTextAreaElement>(null);

  // Examples drift through the empty box.
  useEffect(() => {
    if (!open || text) return;
    const t = window.setInterval(() => setExampleAt((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => window.clearInterval(t);
  }, [open, text]);

  // The live strip: keywords only, a beat after each pause in typing.
  useEffect(() => {
    if (!open || q.length < 6) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q, peek: true }) });
        const json = (await res.json()) as { interpretation?: Interpretation };
        setHeardFor({ q, chips: json.interpretation ? chipsFor(json.interpretation) : [] });
      } catch {
        setHeardFor({ q, chips: [] }); // the strip is a nicety
      }
    }, 550);
    return () => window.clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => box.current?.focus(), 250);
    return () => window.clearTimeout(t);
  }, [open]);

  const close = () => {
    if (busy) return;
    setOpen(false);
  };

  const go = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const json = (await res.json()) as { interpretation?: Interpretation };
      const i = json.interpretation;
      if (!i) throw new Error("no interpretation");
      setHeardFor({ q, chips: chipsFor(i) });
      // No time in the sentence means tonight: 9 while it's still daytime, now in the evening.
      const w = nightWhen();
      if (i.hour === undefined) i.hour = w.hour;
      const params = toResultsParams(i, w.dow, text);
      // If the phone already shares where it is, the walk is measured from there (never a prompt from here).
      const me = await locate("silent");
      if (me && params.get("m") !== "near") params.set("me", formatMe(me));
      if ((i.wants.new ?? 0) > 0) {
        const been = Object.keys(state.been);
        if (been.length) params.set("b", been.join(","));
      }
      window.setTimeout(() => router.push(`/results?${params.toString()}`), 500);
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
        data-sayit-open
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ink)" }}>
          <span className="block h-2.5 w-2.5 rounded-full" style={{ background: "var(--tomato)" }} aria-hidden />
        </span>
        <span className="truncate text-[14px]" style={{ color: "var(--chalk-55)" }}>
          Or just say it…
        </span>
      </button>

      {/* Portaled to the body: the hero above is transformed while it scrolls, which would trap a fixed screen. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-[60] flex justify-center"
                style={{ background: "var(--ink)", color: "var(--on-photo)" }}
                data-sayit-sheet
                role="dialog"
                aria-modal
                aria-label="Just say it"
              >
                <motion.div
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 18, opacity: 0, transition: { duration: 0.16 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex w-full max-w-md flex-col px-5"
                  style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
                >
                  <div className="flex items-center justify-between">
                    <button onClick={close} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Close" style={{ color: "var(--on-photo-80)" }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                      </svg>
                    </button>
                    <span className="eyebrow" style={{ color: "var(--tomato-bright)" }}>
                      Just say it
                    </span>
                    <span className="w-11" aria-hidden />
                  </div>

                  <h2 className="serif mt-6" style={{ fontSize: 34, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
                    What kind of night?
                  </h2>

                  <div className="relative mt-5 flex-1" style={{ minHeight: 168 }}>
                    <textarea
                      ref={box}
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, 400))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void go();
                        }
                        if (e.key === "Escape") close();
                      }}
                      rows={4}
                      maxLength={400}
                      className="serif relative z-10 w-full resize-none bg-transparent outline-none"
                      style={{ fontSize: 28, lineHeight: 1.2, color: "var(--on-photo)", caretColor: "var(--tomato-bright)" }}
                      aria-label="What kind of night"
                      data-sayit-input
                    />
                    <AnimatePresence mode="wait">
                      {!text && (
                        <motion.p
                          key={exampleAt}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6, transition: { duration: 0.35 } }}
                          transition={{ duration: 0.5 }}
                          className="serif pointer-events-none absolute inset-x-0 top-0"
                          style={{ fontSize: 28, lineHeight: 1.2, color: "var(--on-photo-60)" }}
                          aria-hidden
                          data-sayit-example
                        >
                          &ldquo;{EXAMPLES[exampleAt]}&rdquo;
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-2" style={{ minHeight: 64 }} data-sayit-heard>
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--on-photo-60)" }}>
                      <span className={`inline-block h-2 w-2 rounded-full ${listening ? "animate-pulse" : ""}`} style={{ background: heard.length || listening ? "var(--tomato-bright)" : "rgba(246,241,231,0.25)" }} aria-hidden />
                      ROUND hears
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <AnimatePresence>
                        {heard.map((h) => (
                          <motion.span key={h} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.18 }} className="rounded-full border px-3 py-1 text-[13px] font-medium" style={{ borderColor: "rgba(246,241,231,0.28)", color: "var(--on-photo)", background: "rgba(246,241,231,0.08)" }} data-heard-chip>
                            {h}
                          </motion.span>
                        ))}
                      </AnimatePresence>
                      {!heard.length && (
                        <span className="text-[13px]" style={{ color: "rgba(246,241,231,0.45)" }}>
                          {text.trim().length >= 6 ? "…" : "The neighborhood, how many, when, and anything you care about."}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 text-[12px]" style={{ color: "rgba(246,241,231,0.45)" }}>
                    Type it like you&apos;d text a friend, or tap the mic on your keyboard and talk.
                  </p>
                  <button
                    onClick={() => void go()}
                    disabled={busy || !text.trim()}
                    className="pressable mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold"
                    style={{ background: "var(--tomato)", color: "var(--on-photo)", opacity: !text.trim() && !busy ? 0.45 : 1 }}
                    data-sayit-go
                  >
                    {busy ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: "rgba(246,241,231,0.35)", borderTopColor: "var(--on-photo)" }} aria-hidden />
                        Reading the city…
                      </>
                    ) : (
                      "Show me"
                    )}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** What ROUND heard, as chips: the place or the neighborhood first, then the hour, then the rest in the order it was said. */
function chipsFor(i: Interpretation): string[] {
  const c: string[] = [];
  if (i.venue) c.push(i.near ? `near ${i.venue.name}` : i.venue.name);
  else if (i.place) c.push(`near ${i.place.label}`);
  if (i.neighborhood) c.push(neighborhoodName(i.neighborhood));
  if (i.mode === "date") c.push("a date");
  if (i.mode === "dinner") c.push("dinner first");
  if (typeof i.hour === "number") c.push(formatHour(i.hour, true));
  for (const u of i.understood) if (!c.some((x) => x.toLowerCase() === u.toLowerCase())) c.push(u);
  return [...new Set(c)].slice(0, 8);
}
