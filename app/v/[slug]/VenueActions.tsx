"use client";

import { useState } from "react";
import { GoButton, SaveButton, ShareButton, useSignInNudge } from "@/components/Actions";
import { RateSheet, VERDICTS } from "@/components/RateSheet";
import { useRoundStore } from "@/lib/store";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

export function VenueActions({ venue, shareUrl, names }: { venue: Venue; shareUrl: string; names: Record<string, string> }) {
  const { state, markBeen, clearBeen } = useRoundStore();
  const nudge = useSignInNudge("rate");
  const [rating, setRating] = useState(false);
  const been = state.been[venue.slug];
  const verdict = been?.verdict ? VERDICTS.find((v) => v.key === been.verdict) : undefined;
  const ladderAt = (state.ladder ?? []).indexOf(venue.slug);
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2.5">
        <GoButton venue={venue} className="flex-1" />
        <ShareButton url={shareUrl} title={`${venue.name} — ROUND`} text={`${venue.name}, ${neighborhoodName(venue.neighborhood)}. ${venue.take}`} />
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <SaveButton slug={venue.slug} source="venue" compact={false} />
        <button
          onClick={() => {
            if (been) clearBeen(venue.slug);
            else {
              markBeen(venue.slug);
              nudge();
            }
          }}
          aria-pressed={!!been}
          className="pressable btn-ghost flex h-12 items-center gap-2 px-5 text-[14px]"
          style={been ? { background: "rgba(22,33,58,0.14)", borderColor: "rgba(22,33,58,0.3)" } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {been ? "Been" : "I've been"}
        </button>
      </div>
      <button onClick={() => setRating(true)} className="pressable mt-2.5 flex h-12 w-full items-center justify-between gap-3 rounded-full border px-5 text-[14px] font-medium" style={{ borderColor: verdict ? "var(--ink)" : "var(--hairline-strong)", background: verdict ? "rgba(22,33,58,0.06)" : "transparent" }} data-rate-button>
        <span className="flex min-w-0 items-center gap-2">
          <Ring />
          <span className="truncate">{verdict ? verdict.label : `Rate this ${venue.kind === "restaurant" ? "spot" : "bar"}`}</span>
        </span>
        <span className="shrink-0 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
          {verdict ? (ladderAt >= 0 ? `#${ladderAt + 1} on your ladder` : "Change") : "Four taps"}
        </span>
      </button>
      {been?.note && (
        <p className="serif mt-3 text-[17px] leading-snug" style={{ color: "var(--ink-70)" }}>
          &ldquo;{been.note}&rdquo;
        </p>
      )}
      <RateSheet venue={venue} names={names} open={rating} onClose={() => setRating(false)} />
    </div>
  );
}

function Ring() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="var(--tomato)" strokeWidth="2.2" />
    </svg>
  );
}
