"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { SEED_QUESTIONS } from "@/lib/crowdQuestions";
import { encodeWants, type Wants } from "@/lib/questions";
import { nowInNYC } from "@/lib/time";
import type { AttrKey } from "@/lib/attrs";
import type { NeighborhoodId } from "@/lib/types";

/**
 * Or tap it (V35): the ask without typing. A neighborhood, then what the
 * night is for, in the same words people rate bars with (Late night,
 * Dancing, Live music…). What you tap is a must-have: every card has it,
 * checked in code before the picker ever sees the list. The box above stays
 * for anything specific.
 */
const FOR = (SEED_QUESTIONS.find((q) => q.id === "best-bar")?.options ?? []).filter((o) => Object.values(o.attrs ?? {}).some((v) => (v ?? 0) >= 1));

export function AskChips() {
  const router = useRouter();
  const [hood, setHood] = useState<NeighborhoodId | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [going, setGoing] = useState(false);

  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const go = () => {
    if (!hood) return;
    const wants: Wants = {};
    const must: AttrKey[] = [];
    for (const key of picked) {
      const o = FOR.find((x) => x.key === key);
      for (const [a, v] of Object.entries(o?.attrs ?? {}) as [AttrKey, number][]) {
        if (!v) continue;
        wants[a] = Math.max(wants[a] ?? 0, v);
        if (v >= 1 && !must.includes(a)) must.push(a);
      }
    }
    const { hour, minute, dow } = nowInNYC();
    // The night's hour, a quarter at a time; before 4am counts as the night before.
    const t = (hour < 4 ? hour + 24 : hour) + Math.round(minute / 15) * 0.25;
    const sp = new URLSearchParams({ m: "night", n: hood, g: "4", t: String(t), d: String(hour < 4 ? (dow + 6) % 7 : dow) });
    const w = encodeWants(wants);
    if (w) sp.set("w", w);
    if (must.length) sp.set("must", must.join(","));
    setGoing(true);
    router.push(`/results?${sp.toString()}`);
  };

  const chip = (on: boolean) => ({ background: on ? "var(--ink)" : "transparent", color: on ? "var(--paper)" : "var(--ink)", borderColor: on ? "var(--ink)" : "var(--hairline-strong)" });

  return (
    <section className="mt-5" data-ask-chips>
      <p className="eyebrow" style={{ color: "var(--ink-45)" }}>
        Or tap it
      </p>
      <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5" aria-label="Where" data-chips-where>
        {NEIGHBORHOODS.map((n) => (
          <button key={n.id} onClick={() => setHood((h) => (h === n.id ? null : n.id))} className="pressable flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium" style={chip(hood === n.id)} aria-pressed={hood === n.id} data-chip-hood={n.id}>
            {n.short}
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5" aria-label="What for" data-chips-for>
        {FOR.map((o) => (
          <button key={o.key} onClick={() => toggle(o.key)} className="pressable flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium" style={chip(picked.includes(o.key))} aria-pressed={picked.includes(o.key)} data-chip-for={o.key}>
            {o.label}
          </button>
        ))}
      </div>
      {hood && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={go}
          disabled={going}
          className="pressable btn-accent mt-3 flex h-12 w-full items-center justify-center text-[15px] font-semibold"
          style={{ opacity: going ? 0.6 : 1 }}
          data-ask-go
        >
          {going ? "Picking…" : picked.length ? `${NEIGHBORHOODS.find((n) => n.id === hood)?.short}, ${picked.map((k) => FOR.find((o) => o.key === k)?.label.toLowerCase()).join(" + ")} →` : `Three bars in ${NEIGHBORHOODS.find((n) => n.id === hood)?.short} →`}
        </motion.button>
      )}
    </section>
  );
}
