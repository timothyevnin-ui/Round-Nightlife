"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Photo } from "./Photo";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

const NightMap = dynamic(() => import("./NightMap").then((m) => m.NightMap), { ssr: false });

/**
 * The map, full screen: pinch, pan, zoom buttons, every pin. Tap a pin and
 * its card slides up; tap the card to open the place. Escape or X to close.
 */
export function MapSheet({ open, onClose, venues, saved, been, title = "Your NYC" }: { open: boolean; onClose: () => void; venues: Venue[]; saved: Set<string>; been: Set<string>; title?: string }) {
  const [selected, setSelected] = useState<Venue | null>(null);
  const onSelect = useCallback((v: Venue | null) => setSelected(v), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }} className="fixed inset-0 z-[60]" style={{ background: "var(--paper)" }} role="dialog" aria-modal aria-label={title} data-map-sheet>
          <NightMap venues={venues} saved={saved} been={been} onSelect={onSelect} height="100%" interactive rounded={false} focus={{ lat: 40.7275, lng: -73.985, zoom: 12.4 }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            <button onClick={onClose} className="pressable pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border" style={{ background: "rgba(243,237,224,0.92)", borderColor: "var(--hairline-strong)", backdropFilter: "blur(10px)" }} aria-label="Close the map" data-map-close>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </button>
            <span className="eyebrow rounded-full px-3 py-1.5" style={{ background: "rgba(243,237,224,0.92)", backdropFilter: "blur(10px)" }}>
              {title}
            </span>
            <span className="w-11" aria-hidden />
          </div>
          <div className="pointer-events-none absolute left-3 flex gap-2 text-[11px]" style={{ top: "calc(env(safe-area-inset-top, 0px) + 62px)", color: "var(--chalk-70)" }}>
            <Legend color="#d9482b" label="Want to go" ring />
            <Legend color="#16213a" label="Been" />
            <Legend color="rgba(22,33,58,0.35)" label="On ROUND" small />
          </div>
          <AnimatePresence>
            {selected && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }} className="absolute inset-x-3" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
                <Link href={`/v/${selected.slug}`} className="pressable card flex items-center gap-3 p-3" style={{ background: "rgba(251,248,241,0.96)", backdropFilter: "blur(12px)" }} data-map-card>
                  <Photo venue={selected} rounded="rounded-[14px]" className="h-14 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="serif truncate" style={{ fontSize: 21, lineHeight: 1.1 }}>
                      {selected.name}
                    </p>
                    <p className="truncate text-[12.5px]" style={{ color: "var(--chalk-55)" }}>
                      {neighborhoodName(selected.neighborhood)} · {selected.tags.slice(0, 2).join(" · ")}
                      {saved.has(selected.slug) ? " · want to go" : been.has(selected.slug) ? " · been" : ""}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
                    Open
                  </span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Legend({ color, label, ring, small }: { color: string; label: string; ring?: boolean; small?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full px-2 py-1" style={{ background: "rgba(243,237,224,0.86)", backdropFilter: "blur(8px)" }}>
      <span className="block rounded-full" style={{ width: small ? 8 : 10, height: small ? 8 : 10, background: color, boxShadow: ring ? "0 0 0 2px rgba(217,72,43,0.35)" : undefined }} />
      {label}
    </span>
  );
}
