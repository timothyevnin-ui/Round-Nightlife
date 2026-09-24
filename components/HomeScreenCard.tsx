"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * "Add ROUND to your Home Screen." Always on the YOU tab (V26): tap it and the
 * two taps are spelled out for the phone you're on. Android gets the real
 * install button when the browser offers it. Already installed, it says so.
 */

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function standalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function HomeScreenCard() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState<"ios" | "android" | "other" | "installed" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The phone's kind is only knowable on the client; set once it's known.
    const ua = navigator.userAgent;
    const kind = standalone() ? "installed" : /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other";
    const t = window.setTimeout(() => setPhone(kind), 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (phone === "installed" || done) {
    return (
      <section className="card mt-4 flex items-center gap-3 p-4" data-homescreen="installed">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--pine)", color: "var(--paper)" }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[14px]" style={{ color: "var(--ink-70)" }}>
          ROUND is on your Home Screen.
        </p>
      </section>
    );
  }

  return (
    <section className="card mt-4 overflow-hidden" data-homescreen={phone ?? "unknown"}>
      <button onClick={() => setOpen((o) => !o)} className="pressable flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} data-homescreen-toggle>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--ink)" }} aria-hidden>
          <span className="ring-mark" style={{ boxShadow: "inset 0 0 0 2px var(--ink)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="serif block" style={{ fontSize: 21, lineHeight: 1.1 }}>
            Add ROUND to your Home Screen.
          </span>
          <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--ink-55)" }}>
            It opens like an app, full screen, one tap from the group chat.
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms", color: "var(--ink-35)" }}>
          <path d="M2.5 5 7 9.5 11.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden" data-homescreen-steps>
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--hairline)" }}>
              {phone === "android" && deferred ? (
                <>
                  <p className="text-[14px] leading-snug" style={{ color: "var(--ink-70)" }}>
                    One tap. Chrome asks once, and ROUND lands on your Home Screen.
                  </p>
                  <button
                    onClick={async () => {
                      await deferred.prompt();
                      const { outcome } = await deferred.userChoice;
                      if (outcome === "accepted") setDone(true);
                    }}
                    className="pressable btn-primary mt-3 flex h-11 items-center px-5 text-[14px]"
                    data-install-now
                  >
                    Add ROUND
                  </button>
                </>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {(phone === "android"
                    ? [
                        ["Open ROUND in Chrome", "roundnyc.com, not inside another app."],
                        ["Tap the three dots", "Top right of Chrome."],
                        ["Tap Add to Home screen", "Then Install. That's it."],
                      ]
                    : [
                        ["Open ROUND in Safari", "roundnyc.com, not inside Instagram or a text."],
                        ["Tap Share", "The box with the arrow, at the bottom of the screen."],
                        ["Tap Add to Home Screen", "Scroll the list a little. Then Add, top right."],
                      ]
                  ).map(([t, s], i) => (
                    <li key={t} className="flex gap-3">
                      <span className="serif flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ink)", color: "var(--paper)", fontSize: 15 }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-medium">{t}</span>
                        <span className="block text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
                          {s}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[12px]" style={{ color: "var(--ink-35)" }}>
                After that, the ring on your Home Screen is ROUND. No App Store, nothing to update.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
