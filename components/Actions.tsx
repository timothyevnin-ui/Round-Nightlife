"use client";

import { useState, useSyncExternalStore } from "react";
import { directionsUrl, googleMapsUrl } from "@/lib/maps";
import { useRoundStore } from "@/lib/store";
import type { Venue } from "@/lib/types";

const noopSubscribe = () => () => {};

export function GoButton({
  venue,
  label = "GO",
  className = "",
  size = "lg",
}: {
  venue: Pick<Venue, "name" | "address" | "slug">;
  label?: string;
  className?: string;
  size?: "lg" | "md";
}) {
  const { recordGo } = useRoundStore();
  // Server renders the universal link; the client resolves Apple Maps on Apple devices.
  const href = useSyncExternalStore(
    noopSubscribe,
    () => directionsUrl(venue),
    () => googleMapsUrl(venue),
  );
  const h = size === "lg" ? "h-14 text-[17px]" : "h-11 text-[14px] px-4";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={() => recordGo(venue.slug)}
      className={`pressable btn-primary flex items-center justify-center gap-2 px-6 ${h} ${className}`}
      style={{ letterSpacing: "0.08em" }}
    >
      {label}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function SaveButton({ slug, source = "flow", compact = true }: { slug: string; source?: "flow" | "quiz" | "screenshot" | "venue"; compact?: boolean }) {
  const { state, toggleSaved } = useRoundStore();
  const saved = !!state.saved[slug];
  const been = !!state.been[slug];
  if (compact) {
    return (
      <button
        onClick={() => toggleSaved(slug, source)}
        aria-pressed={saved}
        aria-label={saved ? "Saved to Want to Go" : "Want to Go"}
        className="pressable flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
        style={{
          background: saved ? "var(--cobalt)" : "rgba(242,240,234,0.06)",
          borderColor: saved ? "var(--cobalt)" : "var(--hairline)",
        }}
      >
        <BookmarkIcon filled={saved} />
      </button>
    );
  }
  return (
    <button
      onClick={() => toggleSaved(slug, source)}
      aria-pressed={saved}
      className="pressable btn-ghost flex h-12 items-center justify-center gap-2 px-5 text-[14px]"
      style={saved ? { background: "var(--cobalt)", borderColor: "var(--cobalt)" } : undefined}
    >
      <BookmarkIcon filled={saved} />
      {saved ? "Want to go" : been ? "Want to go again" : "Want to go"}
    </button>
  );
}

export function ShareButton({
  url,
  title,
  text,
  compact = true,
  label = "Share",
}: {
  url: string;
  title: string;
  text: string;
  compact?: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: absolute });
        return;
      }
    } catch {
      /* user cancelled */
      return;
    }
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link", absolute);
    }
  };
  if (compact) {
    return (
      <button
        onClick={share}
        aria-label="Share"
        className="pressable flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
        style={{ background: "rgba(242,240,234,0.06)", borderColor: "var(--hairline)" }}
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
    );
  }
  return (
    <button onClick={share} className="pressable btn-ghost flex h-12 items-center justify-center gap-2 px-5 text-[14px]">
      {copied ? <CheckIcon /> : <ShareIcon />}
      {copied ? "Link copied" : label}
    </button>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4.5 3.5h9v11.5L9 11.75 4.5 15V3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 2.5v9M9 2.5 5.75 5.75M9 2.5l3.25 3.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 9.5v4.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3.5 9.5 7.25 13 14.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
