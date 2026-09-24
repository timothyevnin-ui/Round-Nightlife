"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal, flushSync } from "react-dom";
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
  "Brunch in Nolita, then somewhere to keep it going",
  "Bars near Rubirosa, we're getting out of dinner at 10",
];

/**
 * "Just say it." The front door, and the biggest thing on the home screen
 * (V27): a dark box with the examples drifting through it. Tap it and the
 * whole screen goes dark with the keyboard already up, no second tap: the
 * box is focused inside the tap itself (iPhone only shows the keyboard for
 * that). Under the box ROUND says what it's hearing as you go: the
 * neighborhood, the hour, how many, what you care about. Then Show me, and the
 * same picks as any door. It's not only for nights, so it asks "What are we
 * thinking?"
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
  // Starts on the first example on the server and the phone alike (no mismatch), then drifts.
  const [exampleAt, setExampleAt] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  // Examples drift through the box on the home screen, and through the empty box once it's open.
  useEffect(() => {
    if (text) return;
    const t = window.setInterval(() => setExampleAt((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => window.clearInterval(t);
  }, [text]);

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

  /** Open and focus in the same tap: the screen is committed right away so the box exists to focus, and the keyboard comes up with it. */
  const openIt = () => {
    flushSync(() => setOpen(true));
    box.current?.focus({ preventScroll: true });
  };

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
      {/* The box on the home screen: dark, big, the examples drifting through it. */}
      <button
        onClick={openIt}
        className="pressable grain relative w-full overflow-hidden rounded-[26px] p-4 text-left"
        style={{ background: "var(--ink)", color: "var(--on-photo)", boxShadow: "0 18px 40px -22px rgba(22,33,58,0.65)" }}
        aria-label="Just say it"
        data-sayit-open
      >
        <span className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 60% at 90% 0%, rgba(232,105,74,0.32), transparent 60%)" }} aria-hidden />
        <span className="relative flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--tomato)" }} aria-hidden>
            <span className="block h-2.5 w-2.5 rounded-full" style={{ background: "var(--on-photo)" }} />
          </span>
          <span className="serif" style={{ fontSize: 24, lineHeight: 1, letterSpacing: "-0.015em" }} data-sayit-title>
            Just say it.
          </span>
          <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--tomato-bright)" }}>
            ROUND listens
          </span>
        </span>
        <span className="relative mt-3 block" style={{ minHeight: 50 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={exampleAt}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45 }}
              className="serif block"
              style={{ fontSize: 20, lineHeight: 1.2, color: "var(--on-photo-80)" }}
              data-sayit-example-home
            >
              &ldquo;{EXAMPLES[exampleAt]}&rdquo;
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="relative mt-3.5 flex h-12 items-center rounded-full pl-4 pr-1.5" style={{ background: "rgba(246,241,231,0.1)", border: "1px solid rgba(246,241,231,0.18)" }}>
          <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: "var(--on-photo-60)" }}>
            Type it like a text, or talk.
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--tomato)" }} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="#F6F1E7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
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
                className="fixed inset-0 z-[60] flex justify-center overflow-y-auto"
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

                  {/* Everything sits up top, so the keyboard covers nothing that matters. */}
                  <h2 className="serif mt-4" style={{ fontSize: 32, lineHeight: 1.04, letterSpacing: "-0.02em" }} data-sayit-heading>
                    What are we thinking?
                  </h2>

                  <div className="relative mt-4" style={{ minHeight: 140 }}>
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
                      enterKeyHint="go"
                      autoCapitalize="sentences"
                      className="serif relative z-10 w-full resize-none bg-transparent outline-none"
                      style={{ fontSize: 27, lineHeight: 1.2, color: "var(--on-photo)", caretColor: "var(--tomato-bright)" }}
                      aria-label="What are we thinking"
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
                          style={{ fontSize: 27, lineHeight: 1.2, color: "var(--on-photo-60)" }}
                          aria-hidden
                          data-sayit-example
                        >
                          &ldquo;{EXAMPLES[exampleAt]}&rdquo;
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-1" style={{ minHeight: 58 }} data-sayit-heard>
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

                  <button
                    onClick={() => void go()}
                    disabled={busy || !text.trim()}
                    className="pressable mt-3 flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full text-[16px] font-semibold"
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
                  <p className="mt-3 text-[12px]" style={{ color: "rgba(246,241,231,0.45)" }}>
                    Type it like you&apos;d text a friend, or tap the mic on your keyboard and talk. Any time of day.
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
