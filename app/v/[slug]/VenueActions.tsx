"use client";

import { GoButton, SaveButton, ShareButton, useSignInNudge } from "@/components/Actions";
import { useRoundStore } from "@/lib/store";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

export function VenueActions({ venue, shareUrl }: { venue: Venue; shareUrl: string }) {
  const { state, markBeen, clearBeen } = useRoundStore();
  const nudge = useSignInNudge("rate");
  const been = state.been[venue.slug];
  return (
    <div className="mt-6">
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
          style={been ? { background: "rgba(242,240,234,0.14)", borderColor: "rgba(242,240,234,0.3)" } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {been ? "Been" : "I've been"}
        </button>
      </div>
      {been && (
        <div className="mt-4">
          <p className="eyebrow">Your rating</p>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["loved", "Loved it"],
                ["good", "Good"],
                ["meh", "Meh"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => markBeen(venue.slug, { rating: val })}
                className="pressable flex h-11 flex-1 items-center justify-center rounded-full border text-[14px] font-medium"
                style={
                  been.rating === val
                    ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" }
                    : { background: "rgba(242,240,234,0.06)", borderColor: "var(--hairline)" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
