"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Photo } from "./Photo";
import { photosOf } from "@/lib/places";
import type { Venue } from "@/lib/types";

/**
 * The photos on a venue page. One photo is the same big picture as before;
 * more than one swipes sideways with dots, each with its own credit. Whatever
 * sits on top of the first picture (the back button, the friends chip) stays
 * put while the pictures move underneath.
 */
export function Gallery({ venue, children, className = "aspect-[4/5] w-full" }: { venue: Venue; children?: ReactNode; className?: string }) {
  const photos = photosOf(venue);
  const ref = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || photos.length < 2) return;
    const onScroll = () => setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [photos.length]);

  if (photos.length < 2) {
    return (
      <Photo venue={venue} rounded="rounded-none" className={className} credit>
        {children}
      </Photo>
    );
  }
  return (
    <div className={`relative ${className}`} data-gallery={photos.length}>
      <div ref={ref} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {photos.map((p, i) => (
          <Photo key={`${i}-${p.url}`} venue={{ ...venue, photoUrl: p.url, photoCredit: p.credit }} rounded="rounded-none" className="h-full w-full shrink-0 snap-center" credit />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">{children}</div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" data-gallery-dots>
        {photos.map((p, i) => (
          <span key={`${i}-${p.url}`} className="block h-1.5 rounded-full transition-all" style={{ width: i === at ? 18 : 6, background: i === at ? "rgba(246,241,231,0.95)" : "rgba(246,241,231,0.5)" }} />
        ))}
      </div>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "rgba(22,33,58,0.45)", color: "var(--on-photo)", backdropFilter: "blur(8px)", marginTop: "env(safe-area-inset-top, 0px)" }} data-gallery-count>
        {at + 1} / {photos.length}
      </span>
    </div>
  );
}
