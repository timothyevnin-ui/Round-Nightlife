"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { disagree } from "@/app/spots/actions";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { track } from "@/lib/track";
import { useSignInNudge } from "./Actions";
import type { Venue } from "@/lib/types";

/**
 * "Disagree with our take." A reader tells ROUND what it got wrong about a
 * place, in their words. It lands in Studio; if ROUND agrees, the AI reads
 * it into the place and the algorithm learns. Words, not stars: that's what
 * the AI learns from.
 */
export function DisagreeSheet({ venue, open, onClose }: { venue: Pick<Venue, "slug" | "name" | "take">; open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const nudge = useSignInNudge("rate");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    window.setTimeout(() => {
      setText("");
      setErr(null);
      setDone(false);
    }, 300);
  };

  const send = async () => {
    setErr(null);
    setBusy(true);
    let token: string | undefined;
    try {
      const sb = getSupabase();
      token = (await sb?.auth.getSession())?.data.session?.access_token ?? undefined;
    } catch {
      /* anonymous */
    }
    const r = await disagree({ slug: venue.slug, text, token, name: profile?.name ?? undefined });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    track("save", { slug: venue.slug, data: { source: "disagree" } });
    setDone(true);
    if (!user) nudge();
  };

  // Portaled to the body (like Just say it): a transformed ancestor would trap the fixed sheet. Only the sheet is portaled, and only when open, so the server render matches.
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={close} data-disagree-sheet>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[28px] border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-20)" }} />
            {!done ? (
              <>
                <p className="eyebrow" style={{ color: "var(--tomato)" }}>
                  Disagree with our take
                </p>
                <h2 className="serif mt-1" style={{ fontSize: 26, lineHeight: 1.1 }}>
                  {venue.name}: what did we get wrong?
                </h2>
                <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--ink-55)" }}>
                  We said: &ldquo;{venue.take}&rdquo;
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 600))}
                  rows={4}
                  autoFocus
                  placeholder="Say it like you'd text a friend. The food is actually great, get the wings. It's dead on weeknights. Way pricier than $$."
                  className="mt-4 w-full resize-none rounded-[18px] border px-4 py-3 text-[15px] outline-none"
                  style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                  data-disagree-text
                />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <div className="mt-1 flex items-center justify-between text-[11.5px]" style={{ color: "var(--ink-35)" }}>
                  <span>ROUND reads every one. If you&apos;re right, it learns.</span>
                  <span>{600 - text.length}</span>
                </div>
                {err && (
                  <p className="mt-2 text-[13px]" style={{ color: "var(--tomato)" }} data-disagree-error>
                    {err}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button onClick={close} className="pressable btn-ghost flex h-12 items-center justify-center px-5 text-[15px]">
                    Cancel
                  </button>
                  <button onClick={send} disabled={busy || text.trim().length < 6} className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]" style={{ opacity: busy || text.trim().length < 6 ? 0.55 : 1 }} data-disagree-send>
                    {busy ? "Sending…" : "Tell ROUND"}
                  </button>
                </div>
              </>
            ) : (
              <div data-disagree-done>
                <p className="eyebrow" style={{ color: "var(--tomato)" }}>
                  Noted
                </p>
                <h2 className="serif mt-1" style={{ fontSize: 26, lineHeight: 1.1 }}>
                  Thanks. ROUND is reading it.
                </h2>
                <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--ink-70)" }}>
                  Every disagreement goes to a person at ROUND. When we agree, the AI learns it about {venue.name}, and the next pick is sharper for everyone.
                </p>
                <button onClick={close} className="pressable btn-primary mt-5 flex h-12 w-full items-center justify-center text-[15px]">
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
