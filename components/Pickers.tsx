"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { formatHour } from "@/lib/time";

/* ───────────────────────── Wheel: "how many?" ───────────────────────── */

const ITEM = 56;

/** An iOS-style picker: scroll, snap, the number in the middle is the answer. */
export function Wheel({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef<number | null>(null);

  // Start centered on the current value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    el.scrollTop = i * ITEM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (settling.current) window.clearTimeout(settling.current);
    settling.current = window.setTimeout(() => {
      const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM)));
      if (options[i] && options[i].value !== value) onChange(options[i].value);
    }, 60);
  };

  const goTo = (i: number) => ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" });

  return (
    <div className="relative mx-auto w-full max-w-[260px]" style={{ height: ITEM * 5 }}>
      {/* The selection window */}
      <div className="pointer-events-none absolute inset-x-0 rounded-[18px]" style={{ top: ITEM * 2, height: ITEM, background: "var(--ink-6)", border: "1px solid var(--hairline-strong)" }} />
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar h-full overflow-y-auto"
        style={{ scrollSnapType: "y mandatory", paddingTop: ITEM * 2, paddingBottom: ITEM * 2, WebkitOverflowScrolling: "touch" }}
        role="listbox"
        aria-label="How many"
      >
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              role="option"
              aria-selected={selected}
              onClick={() => goTo(i)}
              className="serif flex w-full items-center justify-center"
              style={{ height: ITEM, scrollSnapAlign: "center", fontSize: selected ? 44 : 30, color: selected ? "var(--ink)" : "var(--ink-35)", transition: "font-size 120ms ease, color 120ms ease" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {/* Fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: ITEM * 1.6, background: "linear-gradient(180deg, var(--paper), transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: ITEM * 1.6, background: "linear-gradient(0deg, var(--paper), transparent)" }} />
    </div>
  );
}

/* ───────────────────────── Dial: "when?" ───────────────────────── */

const MIN = 11; // 11am: day drinking starts here
const MAX = 27; // 3am

function caption(h: number) {
  if (h < 13) return "Lunch-ish";
  if (h < 15.5) return "Day drinking";
  if (h < 17) return "Afternoon";
  if (h < 18.5) return "Happy hour";
  if (h < 20) return "Early";
  if (h < 21.5) return "Dinner-ish";
  if (h < 23.5) return "Prime time";
  if (h < 25) return "Late";
  return "After hours";
}

/** Sky color for an hour: daylight blue → dusk gold → tomato → navy → near-black. */
function sky(h: number) {
  if (h < 15) return "linear-gradient(135deg, #7fb3d5, #f2d38a)";
  if (h < 17) return "linear-gradient(135deg, #f2d38a, #f2c14e)";
  if (h < 19.5) return "linear-gradient(135deg, #f2c14e, #e8694a)";
  if (h < 22) return "linear-gradient(135deg, #e8694a, #7a3a4a)";
  if (h < 25) return "linear-gradient(135deg, #3a3a6e, #16213a)";
  return "linear-gradient(135deg, #16213a, #0b0f1c)";
}

/**
 * The evening as a slider. Drag from happy hour to after hours; the sky
 * changes with you. Snaps to the quarter hour.
 */
export function TimeDial({ value, onChange, nowValue }: { value: number; onChange: (h: number) => void; nowValue?: number }) {
  const [h, setH] = useState(() => Math.max(MIN, Math.min(MAX, value)));
  const set = (n: number) => {
    const q = Math.round(n * 4) / 4;
    setH(q);
    onChange(q);
  };
  const pct = ((h - MIN) / (MAX - MIN)) * 100;
  const chips: { label: string; value: number }[] = [
    ...(nowValue !== undefined ? [{ label: "Now", value: Math.max(MIN, Math.min(MAX, nowValue)) }] : []),
    { label: "2pm", value: 14 },
    { label: "5", value: 17 },
    { label: "8", value: 20 },
    { label: "9", value: 21 },
    { label: "11", value: 23 },
    { label: "Late", value: 24.5 },
  ];

  return (
    <div>
      <motion.div
        className="grain relative overflow-hidden rounded-[26px] p-5"
        animate={{ background: sky(h) }}
        transition={{ duration: 0.4 }}
        style={{ background: sky(h), color: "var(--on-photo)", minHeight: 170 }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 60% at 80% 10%, rgba(255,255,255,0.18), transparent 60%)" }} />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="eyebrow" style={{ color: "var(--on-photo-80)" }}>
              {caption(h)}
            </p>
            <p className="serif mt-1" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {formatHour(h, true)}
            </p>
          </div>
          <motion.span
            aria-hidden
            className="mb-2 block rounded-full"
            animate={{ y: h < 20 ? 0 : 6, opacity: h < 25 ? 1 : 0.5, background: h < 17 ? "#fff3b0" : h < 20 ? "#f2c14e" : "#f6f1e7" }}
            style={{ width: 22, height: 22, boxShadow: "0 0 24px rgba(246,241,231,0.6)" }}
          />
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.25}
          value={h}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="What time"
          className="dial relative mt-5 w-full"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <div className="relative mt-1.5 flex justify-between text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--on-photo-60)" }}>
          <span>11am</span>
          <span>5pm</span>
          <span>Midnight</span>
          <span>3am</span>
        </div>
      </motion.div>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => set(c.value)}
            className="pressable flex h-10 min-w-[52px] items-center justify-center rounded-full border px-4 text-[14px] font-medium"
            style={Math.abs(c.value - h) < 0.01 ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
