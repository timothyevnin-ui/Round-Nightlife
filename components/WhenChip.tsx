"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { TimeDial } from "./Pickers";
import { DAY_NAMES, formatHour } from "@/lib/time";
import { isDayHour, nowWhen, setWhen, useWhen, whenLabel } from "@/lib/when";

const noop = () => () => {};

/**
 * "It's Wednesday · 3:40pm" on Home. It reads the phone's clock; tap it to
 * plan ahead (9 tonight, Saturday afternoon) and every flow starts there.
 */
export function WhenChip() {
  const planned = useWhen();
  // Snapshot must be a stable primitive (a fresh object each call would re-render forever).
  const nowKey = useSyncExternalStore(noop, () => {
    const n = nowWhen();
    return `${n.hour}|${n.dow}`;
  }, () => "");
  const [open, setOpen] = useState(false);
  if (!nowKey) return <p className="eyebrow" style={{ minHeight: 14 }} />;
  const [nh, nd] = nowKey.split("|").map(Number);
  const now = { hour: nh, dow: nd };
  const w = planned ?? { ...now };
  const day = isDayHour(w.hour);
  const text = planned ? whenLabel(planned) : `It's ${DAY_NAMES[now.dow]} · ${formatHour(now.hour, true)}`;
  return (
    <>
      <button onClick={() => setOpen(true)} className="pressable -ml-1 inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3" style={{ background: planned ? "rgba(22,33,58,0.06)" : "transparent" }} aria-label="Change when" data-when-chip data-day={day ? "1" : undefined}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: day ? "#f2c14e" : "var(--ink)", color: day ? "var(--ink)" : "var(--paper)" }} aria-hidden>
          {day ? <Sun /> : <Moon />}
        </span>
        <span className="eyebrow" style={{ color: "var(--ink-70)" }}>
          {text}
        </span>
        <span className="text-[11px] font-medium" style={{ color: "var(--ink-35)" }}>
          {planned ? "change" : "plan ahead"}
        </span>
      </button>
      <WhenSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function WhenSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const planned = useWhen();
  const now = nowWhen();
  const [hour, setHour] = useState(() => Math.max(11, Math.min(27, planned?.hour ?? now.hour)));
  const [dow, setDow] = useState(planned?.dow ?? now.dow);
  const days = [0, 1, 2, 3, 4, 5, 6].map((k) => (now.dow + k) % 7);
  const dayName = (d: number) => (d === now.dow ? "Today" : d === (now.dow + 1) % 7 ? "Tomorrow" : DAY_NAMES[d].slice(0, 3));
  const save = () => {
    setWhen({ hour, dow });
    onClose();
  };
  const reset = () => {
    setWhen(null);
    setHour(Math.max(11, Math.min(27, now.hour)));
    setDow(now.dow);
    onClose();
  };
  // Portaled to the body: the hero above it is transformed while it scrolls, which would trap a fixed sheet under the tab bar.
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={onClose} data-when-sheet>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[28px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-20)" }} />
            <p className="eyebrow">When are we going?</p>
            <h2 className="serif mt-1" style={{ fontSize: 28, lineHeight: 1.05 }}>
              {dayName(dow) === "Today" ? (isDayHour(hour) ? "Today" : "Tonight") : DAY_NAMES[dow]} · {formatHour(hour, true)}
            </h2>
            <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
              {days.map((d) => (
                <button key={d} onClick={() => setDow(d)} className="pressable flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium" style={dow === d ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" }}>
                  {dayName(d)}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <TimeDial value={hour} nowValue={dow === now.dow ? now.hour : undefined} onChange={setHour} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={save} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" data-when-save>
                {isDayHour(hour) ? "Plan the day" : "Plan the night"}
              </button>
              <button onClick={reset} className="pressable btn-ghost flex h-12 items-center justify-center px-5 text-[15px]">
                Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Sun() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.4" fill="currentColor" />
      <path d="M6 .8v1.6M6 9.6v1.6M.8 6h1.6M9.6 6h1.6M2.3 2.3l1.1 1.1M8.6 8.6l1.1 1.1M2.3 9.7l1.1-1.1M8.6 3.4l1.1-1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function Moon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M8.5 1.5a4.5 4.5 0 1 0 2 8.1A5 5 0 0 1 8.5 1.5Z" fill="currentColor" />
    </svg>
  );
}
