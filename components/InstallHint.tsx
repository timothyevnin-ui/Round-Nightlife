"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * "Add ROUND to your home screen." A web app is forgotten by Saturday unless
 * it's on the phone. iPhone never offers to install one, so on the second
 * visit (not the first: let them see the thing) a small card says the two
 * taps. Android gets the real install prompt when the browser offers it.
 * Dismissed once, it stays away for a month; already installed, never shows.
 */

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const VISITS = "round_visits";
const SNOOZE = "round_install_snooze";

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let visits = 0;
    try {
      if (standalone()) return;
      const snoozed = Number(localStorage.getItem(SNOOZE) ?? 0);
      if (snoozed && Date.now() - snoozed < 30 * 86_400_000) return;
      visits = Number(localStorage.getItem(VISITS) ?? 0) + 1;
      localStorage.setItem(VISITS, String(visits));
    } catch {
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (visits >= 2) setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = window.setTimeout(() => {
      if (ios && visits >= 2) setMode("ios");
    }, 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, []);

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE, String(Date.now()));
    } catch {
      /* private mode */
    }
    setMode(null);
  };

  return (
    <AnimatePresence>
      {mode && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card mt-6 p-4" style={{ background: "var(--surface)" }} data-install-hint={mode}>
          <div className="flex items-start gap-3">
            <span className="ring-mark mt-1 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="serif" style={{ fontSize: 21, lineHeight: 1.1 }}>
                Put ROUND on your home screen.
              </p>
              <p className="mt-1 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
                {mode === "ios" ? (
                  <>
                    Tap <ShareGlyph /> at the bottom of Safari, then <span className="font-semibold" style={{ color: "var(--ink)" }}>Add to Home Screen</span>. It opens like an app, full screen, no address bar.
                  </>
                ) : (
                  "One tap. It opens like an app, full screen, no address bar."
                )}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {mode === "android" && deferred && (
                  <button
                    onClick={async () => {
                      await deferred.prompt();
                      const { outcome } = await deferred.userChoice;
                      if (outcome === "accepted") setMode(null);
                    }}
                    className="pressable btn-primary flex h-10 items-center px-4 text-[13.5px]"
                    data-install-now
                  >
                    Add ROUND
                  </button>
                )}
                <button onClick={snooze} className="pressable btn-ghost flex h-10 items-center px-4 text-[13.5px]" data-install-later>
                  {mode === "ios" ? "Got it" : "Not now"}
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ShareGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-label="Share" className="inline-block align-[-2px]">
      <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7v6.5h10V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
