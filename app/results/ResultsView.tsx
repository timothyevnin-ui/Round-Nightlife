"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Carousel } from "@/components/Carousel";
import { PlanResultCard, ResultCard } from "@/components/ResultCard";
import { ShareButton } from "@/components/Actions";
import { useRoundStore } from "@/lib/store";
import type { DatePlan, Mode, NightPick } from "@/lib/types";

type Props = {
  mode: Mode | "near";
  /** The door's name when it isn't the mode's ("Day out" for the daylight door). */
  title?: string;
  summary: string[];
  /** What ROUND understood, in plain words (from the model). */
  heard?: string;
  /** Before 5pm (the picks already know; the page keeps the door's name). */
  day?: boolean;
  editHref: string;
  code: string;
  night?: (NightPick & { shareCode: string })[];
  plans?: (DatePlan & { shareCode: string })[];
  groupWord?: string;
};

const TITLE: Record<Mode | "near", string> = { night: "Night out", date: "Date", dinner: "Dinner & drinks", near: "Near me" };

export function ResultsView({ mode, title, summary, heard, editHref, code, night, plans, groupWord }: Props) {
  const router = useRouter();
  const { rememberResults } = useRoundStore();

  useEffect(() => {
    rememberResults(window.location.pathname + window.location.search);
  }, [rememberResults]);

  const bars = mode === "night" || mode === "near";
  const items = bars ? night ?? [] : plans ?? [];
  const count = items.length;
  const labels = items.map((i) => i.label);
  const headline = count === 0 ? (mode === "near" ? "Nothing close enough." : "Nothing yet.") : bars ? `${WORD[count] ?? count} ${mode === "near" ? "nearby" : "places"}.` : `${WORD[count] ?? count} plans.`;

  return (
    <main className="screen mx-auto w-full max-w-md pb-16" style={{ overflowX: "clip" }}>
      <header className="flex items-center justify-between pt-4 pb-2">
        <button onClick={() => router.back()} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">{title ?? TITLE[mode]}</span>
        <Link href="/" className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="pt-2 pb-4">
        <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {headline} <span style={{ color: "var(--ink-55)" }}>Swipe.</span>
        </h1>
        {heard && count > 0 && (
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--ink-55)" }} data-heard>
            We heard: <span style={{ color: "var(--ink)" }}>{heard.replace(/\.$/, "")}</span>.
          </p>
        )}
        <Link href={editHref} className="pressable no-scrollbar -mx-5 mt-3 flex items-center gap-1.5 overflow-x-auto px-5" aria-label="Change your answers">
          {summary.map((s) => (
            <span key={s} className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-70)", background: "var(--surface)" }}>
              {s}
            </span>
          ))}
          <span className="ml-1 shrink-0 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Change
          </span>
        </Link>
      </motion.section>

      {count > 0 ? (
        <Carousel count={count} labels={labels}>
          {bars
            ? night!.map((p, i) => <ResultCard key={p.venue.slug} venue={p.venue} label={p.label} why={p.why} shareUrl={`/p/${p.shareCode}`} index={i} />)
            : plans!.map((p, i) => <PlanResultCard key={`${p.restaurant?.slug ?? ""}-${p.bar.slug}`} plan={p} shareUrl={`/p/${p.shareCode}`} index={i} groupWord={groupWord} />)}
        </Carousel>
      ) : (
        <div className="card p-6 text-[15px]" style={{ color: "var(--ink-70)" }}>
          {mode === "near" ? "No ROUND bars within a fifteen-minute walk of there yet. Try an address in the West Village, East Village, LES, SoHo, Tribeca, Chelsea, Williamsburg or Greenpoint." : "ROUND doesn't cover that combination yet. Try a neighborhood next door."}
        </div>
      )}

      {count > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col items-center gap-3">
          <ShareButton
            compact={false}
            label={bars ? "Send these to the group chat" : "Send the plans"}
            url={`/p/${code}`}
            title="Tonight — ROUND"
            text={bars ? "ROUND says one of these." : "ROUND planned the evening."}
          />
          <p className="text-[12px]" style={{ color: "var(--ink-35)" }}>
            {bars ? "They tap one. You go." : "One link. The whole evening."}
          </p>
        </motion.div>
      )}
    </main>
  );
}

const WORD: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six" };
