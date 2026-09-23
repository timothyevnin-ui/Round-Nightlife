"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { RealMap } from "./RealMap";
import { TimeDial, Wheel } from "./Pickers";
import type { NeighborhoodId } from "@/lib/types";

export type FlowOption = {
  value: string;
  label: string;
  sub?: string;
  art?: { from: string; to: string; angle?: number };
};

export type FlowStep = {
  id: string;
  question: string;
  hint?: string;
  layout: "grid" | "visual" | "numbers" | "pills" | "list" | "map" | "wheel" | "dial";
  options: FlowOption[];
  defaultValue?: string;
  /** dial only: the "Now" shortcut, when it's evening. */
  nowValue?: number;
};

const WALK = ["var(--walk-1)", "var(--walk-2)", "var(--walk-3)", "var(--walk-4)", "var(--walk-5)"];

export function Flow({
  steps,
  title,
  onComplete,
}: {
  steps: FlowStep[];
  title: string;
  onComplete: (answers: Record<string, string>, quick?: boolean) => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const advancing = useRef(false);

  const step = steps[Math.min(index, steps.length - 1)];
  const glow = WALK[Math.min(index, WALK.length - 1)];

  const defaults = useMemo(
    () => Object.fromEntries(steps.map((s) => [s.id, s.defaultValue ?? s.options[0]?.value])),
    [steps],
  );

  const finish = useCallback(
    (partial: Record<string, string>, quick = false) => {
      onComplete({ ...defaults, ...partial }, quick);
    },
    [defaults, onComplete],
  );

  const select = useCallback(
    (value: string) => {
      if (advancing.current) return;
      advancing.current = true;
      setPending(value);
      const next = { ...answers, [step.id]: value };
      setAnswers(next);
      window.setTimeout(() => {
        advancing.current = false;
        setPending(null);
        // Decide from where the flow actually is now, not from the render this handler came from:
        // a handler from an earlier step must never push the index past the last step.
        if (indexRef.current >= steps.length - 1) finish(next);
        else {
          setDirection(1);
          setIndex((i) => Math.min(i + 1, steps.length - 1));
        }
      }, 170);
    },
    [answers, finish, step.id, steps.length],
  );

  const back = useCallback(() => {
    if (index === 0) router.push("/");
    else {
      setDirection(-1);
      setIndex((i) => i - 1);
    }
  }, [index, router]);

  const current = pending ?? answers[step.id];
  const suggested = current === undefined ? step.defaultValue : undefined;

  return (
    <main
      className="screen relative mx-auto flex w-full max-w-md flex-col overflow-hidden"
      style={{ minHeight: "100dvh" }}
    >
      {/* The blue that walks with you through the questions. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ background: `radial-gradient(90% 55% at 50% -10%, ${glowToRgba(index)}, transparent 70%)` }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ background: `radial-gradient(90% 55% at 50% -10%, ${glowToRgba(index)}, transparent 70%)` }}
      />

      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        <button onClick={back} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className="block rounded-full transition-all duration-300"
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                background: i <= index ? "var(--chalk)" : "var(--chalk-20)",
              }}
            />
          ))}
        </div>
        <button
          onClick={() => router.push("/")}
          className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col pt-6 pb-10">
        <p className="eyebrow">{title}</p>
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={step.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
            className="flex flex-1 flex-col"
          >
            <h1 className="serif mt-3" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
              {step.question}
            </h1>
            {step.hint && (
              <p className="mt-2 text-[14px]" style={{ color: "var(--chalk-55)" }}>
                {step.hint}
              </p>
            )}

            <div className={step.layout === "map" ? "mt-5" : "mt-8"}>
              {step.layout === "map" ? (
                <MapStep step={step} current={current} suggested={suggested} onSelect={select} />
              ) : step.layout === "wheel" || step.layout === "dial" ? (
                <ConfirmStep key={step.id} step={step} initial={current ?? step.defaultValue ?? step.options[0]?.value ?? ""} draft={draft} setDraft={setDraft} onConfirm={(v) => { setDraft(null); select(v); }} />
              ) : (
                <Options step={step} current={current} suggested={suggested} onSelect={select} />
              )}
            </div>
          </motion.section>
        </AnimatePresence>

        {index === 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            onClick={() => finish(answers, true)}
            className="pressable btn-ghost mx-auto mt-8 h-12 px-6 text-[14px]"
          >
            Just tell me
          </motion.button>
        )}
      </div>
      <span className="sr-only" style={{ color: glow }} />
    </main>
  );
}

const variants = {
  enter: (d: number) => ({ x: 48 * d, opacity: 0, scale: 0.985 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (d: number) => ({ x: -48 * d, opacity: 0, scale: 0.985 }),
};

function glowToRgba(i: number) {
  // blue-1 … blue-5 as rgba glows; deeper at the start, brighter as you go.
  const glows = [
    "rgba(31, 74, 60, 0.30)",
    "rgba(31, 74, 60, 0.24)",
    "rgba(46, 107, 82, 0.22)",
    "rgba(22, 33, 58, 0.20)",
    "rgba(46, 68, 112, 0.20)",
  ];
  return glows[Math.min(i, glows.length - 1)];
}

function Options({
  step,
  current,
  suggested,
  onSelect,
}: {
  step: FlowStep;
  current?: string;
  suggested?: string;
  onSelect: (v: string) => void;
}) {
  const base = "pressable text-left";
  // Three states: selected (filled chalk), suggested default (chalk outline), idle.
  const stateStyle = (v: string) =>
    v === current
      ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" }
      : v === suggested
        ? { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--ink-55)" }
        : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" };

  if (step.layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {step.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={`${base} flex h-[64px] items-center rounded-[18px] border px-4 text-[16px] font-medium`}
            style={stateStyle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  if (step.layout === "list") {
    return (
      <div className="flex flex-col gap-2.5">
        {step.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={`${base} flex min-h-[72px] flex-col justify-center rounded-[20px] border px-5 py-4`}
            style={stateStyle(o.value)}
          >
            <span className="text-[17px] font-medium">{o.label}</span>
            {o.sub && (
              <span className="mt-0.5 text-[13px]" style={{ opacity: 0.6 }}>
                {o.sub}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (step.layout === "visual") {
    return (
      <div className="flex flex-col gap-2.5">
        {step.options.map((o) => {
          const selected = o.value === current;
          const isSuggested = o.value === suggested;
          const art = o.art ?? { from: "#161922", to: "#3a4150", angle: 160 };
          return (
            <button
              key={o.value}
              onClick={() => onSelect(o.value)}
              className={`${base} grain relative flex h-[104px] items-end overflow-hidden rounded-[22px] border p-4`}
              style={{
                background: `linear-gradient(${art.angle ?? 160}deg, ${art.from}, ${art.to})`,
                color: "var(--on-photo)",
                borderColor: selected ? "var(--ink)" : isSuggested ? "var(--ink-35)" : "transparent",
                boxShadow: selected ? "0 0 0 1.5px var(--chalk) inset" : "none",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)" }}
              />
              <div className="relative">
                <div className="serif" style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-0.01em" }}>
                  {o.label}
                </div>
                {o.sub && (
                  <div className="mt-1 text-[13px]" style={{ color: "var(--on-photo-80)" }}>
                    {o.sub}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (step.layout === "numbers") {
    return (
      <div className="grid grid-cols-5 gap-2.5">
        {step.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={`${base} flex aspect-square items-center justify-center rounded-full border text-[19px] font-medium`}
            style={stateStyle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  // pills
  return (
    <div className="flex flex-wrap gap-2.5">
      {step.options.map((o) => (
        <button
          key={o.value}
          onClick={() => onSelect(o.value)}
          className={`${base} flex h-[56px] min-w-[64px] items-center justify-center rounded-full border px-5 text-[17px] font-medium`}
          style={stateStyle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The map, plus the same neighborhoods as small chips underneath. */
function MapStep({ step, current, suggested, onSelect }: { step: FlowStep; current?: string; suggested?: string; onSelect: (v: string) => void }) {
  const value = (current ?? suggested) as NeighborhoodId | undefined;
  return (
    <div>
      <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--hairline)", background: "var(--paper-2)" }}>
        <RealMap value={value} onSelect={(id) => onSelect(id)} />
      </div>
      <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
        Tap a neighborhood. More of the city as ROUND grows.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="pressable flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium"
            style={o.value === current ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Wheel and dial answer continuously; a Next button confirms. */
function ConfirmStep({ step, initial, draft, setDraft, onConfirm }: { step: FlowStep; initial: string; draft: string | null; setDraft: (v: string) => void; onConfirm: (v: string) => void }) {
  const value = draft ?? initial;
  return (
    <div>
      {step.layout === "wheel" ? (
        <Wheel options={step.options} value={value} onChange={setDraft} />
      ) : (
        <TimeDial value={Number(value) || 21} nowValue={step.nowValue} onChange={(h) => setDraft(String(h))} />
      )}
      <button onClick={() => onConfirm(value)} className="pressable btn-primary mt-6 flex h-14 w-full items-center justify-center text-[16px]">
        Next
      </button>
    </div>
  );
}
