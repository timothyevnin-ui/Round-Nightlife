"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { VenueCard } from "@/components/VenueCard";
import { PlanCard } from "@/components/PlanCard";
import { ShareButton } from "@/components/Actions";
import { useRoundStore } from "@/lib/store";
import type { DatePlan, NightPick } from "@/lib/types";

type Props = {
  mode: "night" | "date";
  summary: string[];
  editHref: string;
  code: string;
  night?: (NightPick & { shareCode: string })[];
  date?: (DatePlan & { shareCode: string })[];
};

export function ResultsView({ mode, summary, editHref, code, night, date }: Props) {
  const router = useRouter();
  const { rememberResults } = useRoundStore();

  useEffect(() => {
    rememberResults(window.location.pathname + window.location.search);
  }, [rememberResults]);

  const count = mode === "night" ? night?.length ?? 0 : date?.length ?? 0;
  const headline = count === 0 ? "Nothing yet." : count === 1 ? "One place." : count === 2 ? "Two places." : "Three places.";

  return (
    <main className="screen mx-auto w-full max-w-md pb-16">
      <header className="flex items-center justify-between pt-4 pb-2">
        <button onClick={() => router.back()} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">{mode === "night" ? "Night out" : "Date"}</span>
        <Link href="/" className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="pt-4 pb-6">
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {headline}
          <br />
          <span style={{ color: "var(--chalk-55)" }}>Pick one.</span>
        </h1>
        <Link href={editHref} className="pressable mt-4 flex flex-wrap items-center gap-1.5" aria-label="Change your answers">
          {summary.map((s) => (
            <span
              key={s}
              className="inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--chalk-70)" }}
            >
              {s}
            </span>
          ))}
          <span className="ml-1 text-[12.5px]" style={{ color: "var(--chalk-35)" }}>
            Change
          </span>
        </Link>
      </motion.section>

      <section className="flex flex-col gap-4">
        {mode === "night" &&
          night?.map((p, i) => (
            <VenueCard key={p.venue.slug} venue={p.venue} label={p.label} why={p.why} shareUrl={`/p/${p.shareCode}`} index={i} />
          ))}
        {mode === "date" && date?.map((p, i) => <PlanCard key={`${p.restaurant?.slug ?? ""}-${p.bar.slug}`} plan={p} shareUrl={`/p/${p.shareCode}`} index={i} />)}
        {count === 0 && (
          <div className="card p-6 text-[15px]" style={{ color: "var(--chalk-70)" }}>
            ROUND doesn&apos;t cover that combination yet. Try a neighborhood next door.
          </div>
        )}
      </section>

      {count > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col items-center gap-3">
          <ShareButton
            compact={false}
            label={mode === "date" ? "Send the plan" : `Send these ${count === 1 ? "" : count === 2 ? "two " : "three "}to the group chat`}
            url={`/p/${code}`}
            title="Tonight — ROUND"
            text={mode === "night" ? "ROUND says one of these three." : "ROUND planned the evening."}
          />
          <p className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
            {mode === "date" ? "One link. The whole evening." : "They tap one. You go."}
          </p>
        </motion.div>
      )}
    </main>
  );
}
