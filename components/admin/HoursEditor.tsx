"use client";

import { useState } from "react";
import { DAY_SHORT, everyDay } from "@/lib/hours";
import type { DayHours, Hours } from "@/lib/types";

/**
 * Posted hours without the spreadsheet: a few presets that cover most bars,
 * "same every night" with one pair of times, or the full week when a place
 * is fussy. Sunday first in the data, Monday first on screen.
 */

const PRESETS: { label: string; hours: Hours }[] = [
  { label: "5pm–2am every night", hours: everyDay("17:00", "02:00") },
  { label: "6pm–4am every night", hours: everyDay("18:00", "04:00") },
  { label: "Noon–4am every night", hours: everyDay("12:00", "04:00") },
  { label: "4pm–midnight, later on weekends", hours: [{ open: "16:00", close: "00:00" }, { open: "16:00", close: "00:00" }, { open: "16:00", close: "00:00" }, { open: "16:00", close: "00:00" }, { open: "16:00", close: "01:00" }, { open: "16:00", close: "02:00" }, { open: "16:00", close: "02:00" }] },
];

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursEditor({ value, onChange }: { value: Hours | undefined; onChange: (h: Hours | undefined) => void }) {
  const [mode, setMode] = useState<"same" | "week">(() => (value && new Set(value.map((d) => JSON.stringify(d))).size > 1 ? "week" : "same"));
  const same: DayHours = value?.find((d) => d) ?? { open: "18:00", close: "02:00" };

  const setDay = (i: number, d: DayHours) => {
    const next = [...(value ?? everyDay("18:00", "02:00"))] as Hours;
    next[i] = d;
    onChange(next);
  };

  return (
    <div data-hours-editor>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.hours)} className="pressable h-9 rounded-full border px-3 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--chalk-70)" }}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => onChange(undefined)} className="pressable h-9 rounded-full border px-3 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--chalk-55)" }}>
          Don&apos;t know yet
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12.5px]">
        <button type="button" onClick={() => setMode("same")} className="pressable rounded-full px-3 py-1 font-medium" style={mode === "same" ? { background: "var(--chalk)", color: "var(--chalk-black)" } : { color: "var(--chalk-55)" }}>
          Same every night
        </button>
        <button type="button" onClick={() => setMode("week")} className="pressable rounded-full px-3 py-1 font-medium" style={mode === "week" ? { background: "var(--chalk)", color: "var(--chalk-black)" } : { color: "var(--chalk-55)" }}>
          Day by day
        </button>
      </div>

      {mode === "same" ? (
        <div className="mt-3 flex items-center gap-2">
          <TimeInput value={same?.open ?? "18:00"} onChange={(t) => onChange(everyDay(t, same?.close ?? "02:00"))} />
          <span style={{ color: "var(--chalk-55)" }}>to</span>
          <TimeInput value={same?.close ?? "02:00"} onChange={(t) => onChange(everyDay(same?.open ?? "18:00", t))} />
          {!value && (
            <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
              (not set yet)
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {ORDER.map((i) => {
            const d = value?.[i] ?? null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-9 text-[13px] font-medium" style={{ color: "var(--chalk-70)" }}>
                  {DAY_SHORT[i]}
                </span>
                {d ? (
                  <>
                    <TimeInput value={d.open} onChange={(t) => setDay(i, { open: t, close: d.close })} />
                    <span style={{ color: "var(--chalk-55)" }}>to</span>
                    <TimeInput value={d.close} onChange={(t) => setDay(i, { open: d.open, close: t })} />
                    <button type="button" onClick={() => setDay(i, null)} className="pressable text-[12px]" style={{ color: "var(--chalk-35)" }}>
                      closed
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setDay(i, { open: "18:00", close: "02:00" })} className="pressable text-[13px]" style={{ color: "var(--chalk-55)" }}>
                    Closed · tap to open
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-10 rounded-[12px] border px-2.5 text-[14px] outline-none"
      style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" }}
    />
  );
}
