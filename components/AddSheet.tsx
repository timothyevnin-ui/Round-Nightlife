"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BOUNTY_AMOUNT, BOUNTY_CAP, money } from "@/lib/bounty";

/**
 * The + sheet (V34): the one place the city's help is asked for, on every
 * screen. Two things to do: rate a bar you've been to, or add one ROUND
 * doesn't have for the $7.
 */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  if (typeof document === "undefined") return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "var(--scrim)", backdropFilter: "blur(6px)" }} onClick={onClose} data-add-sheet>
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="theme-paper w-full max-w-md rounded-t-[28px] border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", color: "var(--ink)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-20)" }} />
            <p className="eyebrow" style={{ color: "var(--tomato)" }}>
              ROUND is built by New York
            </p>
            <h2 className="serif mt-1" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
              What have you got?
            </h2>
            <div className="mt-4 flex flex-col gap-2.5">
              <button onClick={() => go("/search?rate=1")} className="pressable flex items-center gap-4 rounded-[22px] border p-4 text-left" style={{ borderColor: "var(--hairline-strong)", background: "var(--paper)" }} data-add-rate>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ink)", color: "var(--paper)" }} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2.2" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="serif block" style={{ fontSize: 21, lineHeight: 1.1 }}>
                    Been somewhere? Rate it.
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
                    Thirty seconds. It goes on your ladder and teaches the picker.
                  </span>
                </span>
                <Arrow />
              </button>
              <button onClick={() => go("/recommend")} className="pressable flex items-center gap-4 rounded-[22px] p-4 text-left" style={{ background: "linear-gradient(160deg, #8f2a15 0%, #d9482b 60%, #e8694a 100%)", color: "var(--on-photo)" }} data-add-spot>
                <span className="serif flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(246,241,231,0.16)", fontSize: 20 }} aria-hidden>
                  {money(BOUNTY_AMOUNT)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="serif block" style={{ fontSize: 21, lineHeight: 1.1 }}>
                    Know a bar we don&apos;t have? Add it.
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--on-photo-80)" }}>
                    Two minutes. We check it; {money(BOUNTY_AMOUNT)} to your Venmo if it makes the list. First {BOUNTY_CAP} only.
                  </span>
                </span>
                <Arrow light />
              </button>
            </div>
            <button onClick={onClose} className="pressable mt-4 flex h-11 w-full items-center justify-center text-[14px]" style={{ color: "var(--ink-55)" }}>
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Arrow({ light = false }: { light?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: light ? "var(--on-photo-80)" : "var(--ink-35)", flexShrink: 0 }}>
      <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
