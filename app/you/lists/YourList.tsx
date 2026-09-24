"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Photo } from "@/components/Photo";
import { ScoreChip } from "@/app/you/YouView";
import { useRoundStore } from "@/lib/store";
import { venueMap } from "@/lib/venues";
import { beenRows, rungs, type Rung } from "@/lib/ladder";
import { neighborhoodName } from "@/lib/neighborhoods";
import { kindWord } from "@/lib/places";
import type { Venue } from "@/lib/types";

export type ListKind = "been" | "want" | "ladder";

const TITLES: Record<ListKind, { title: string; sub: string; empty: string }> = {
  been: { title: "Been", sub: "Every place you've been. The number is where it sits on your ladder.", empty: "Tap I've been on any place. Rate it the morning after and it climbs your ladder." },
  want: { title: "Want to try", sub: "Saved for a night that hasn't happened yet.", empty: "Save a place from the map or a results page and it lands here." },
  ladder: { title: "Your ladder", sub: "Best first. Every rating slots a place above or below the rest, and ROUND picks from the top.", empty: "Rate a place you've been and it takes its rung. ROUND picks from your ladder." },
};

/**
 * One of your lists, as its own page (V27): Been with the numbers, Want to
 * try, or the ladder. Same rows everywhere: the art, the name, the
 * neighborhood, and the score on the right.
 */
export function YourList({ kind, venues }: { kind: ListKind; venues: Venue[] }) {
  const router = useRouter();
  const { state } = useRoundStore();
  const byslug = useMemo(() => venueMap(venues), [venues]);
  const t = TITLES[kind];

  const rows: Rung[] = kind === "been" ? beenRows(state, byslug) : kind === "ladder" ? rungs(state, byslug) : [];
  const saved = kind === "want" ? Object.entries(state.saved).sort((a, b) => b[1].at.localeCompare(a[1].at)).map(([slug]) => byslug[slug]).filter((v): v is Venue => !!v) : [];
  const count = kind === "want" ? saved.length : rows.length;

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-your-list={kind} data-count={count}>
      <header className="flex items-center gap-2 pt-4 pb-2">
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/you"))} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back to You" data-back>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">You</span>
      </header>
      <div className="flex items-end justify-between gap-3">
        <h1 className="serif" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {t.title}
        </h1>
        <span className="pb-1 text-[13px]" style={{ color: "var(--ink-35)" }}>
          {count} {count === 1 ? "place" : "places"}
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
        {t.sub}
      </p>

      {count === 0 ? (
        <div className="card mt-6 p-5">
          <p className="text-[14px] leading-snug" style={{ color: "var(--ink-70)" }}>
            {t.empty}
          </p>
          <Link href="/map" className="pressable btn-primary mt-4 inline-flex h-11 items-center px-5 text-[14px]">
            Open the map
          </Link>
        </div>
      ) : kind === "want" ? (
        <ul className="mt-5 grid grid-cols-2 gap-3" data-list>
          {saved.map((v) => (
            <li key={v.slug}>
              <Link href={`/v/${v.slug}`} className="pressable block" data-row={v.slug}>
                <Photo venue={v} rounded="rounded-[18px]" className="aspect-[4/5] w-full" />
                <p className="serif mt-2 truncate" style={{ fontSize: 18, lineHeight: 1.1 }}>
                  {v.name}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                  {neighborhoodName(v.neighborhood)} · {kindWord(v)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="card mt-5 overflow-hidden" data-list>
          {rows.map((r, i) => (
            <li key={r.venue.slug} className={i < rows.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--hairline)" }}>
              <Link href={`/v/${r.venue.slug}`} className="pressable flex items-center gap-3 px-3.5 py-3" data-row={r.venue.slug} data-rank={r.rank ?? ""}>
                {kind === "ladder" && (
                  <span className="serif w-6 shrink-0 text-right" style={{ fontSize: 20, color: i === 0 ? "var(--tomato)" : "var(--ink-35)" }}>
                    {r.rank}
                  </span>
                )}
                <Photo venue={r.venue} rounded="rounded-[12px]" className="h-14 w-14 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="serif block truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {r.venue.name}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                    {r.entry.note ? `“${r.entry.note}”` : `${neighborhoodName(r.venue.neighborhood)} · ${words(r)}`}
                  </span>
                </span>
                <ScoreChip score={r.score} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

/** The rating in words, or the nudge to give one. */
function words(r: Rung): string {
  const e = r.entry;
  if (e.verdict === "again") return "Take me back tonight";
  if (e.verdict === "back") return "I'd go back";
  if (e.verdict === "fine") return "It was fine";
  if (e.verdict === "never") return "Never again";
  if (e.rating === "loved") return "Loved it";
  if (e.rating === "good") return "Good";
  if (e.rating === "meh") return "Meh";
  return "Not rated yet";
}
