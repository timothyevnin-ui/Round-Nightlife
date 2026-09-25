"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { cleanCode, GOAL, redeemReferral, redeemWords, referralLink, referralProgress, REWARD, type Progress } from "@/lib/referrals";

/**
 * "Refer 10 friends, get $5" (V28), on YOU. Your code, big; Share your link
 * (the code rides in it); the bar filling toward ten, with the first names of
 * who joined. A new account that came without a code can add one here for two
 * weeks.
 */
export function ReferralCard() {
  const { user, profile, updateProfile } = useAuth();
  const sb = getSupabase();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!sb || !user) return;
    let live = true;
    void referralProgress(sb).then((p) => {
      if (live) setProgress(p);
    });
    return () => {
      live = false;
    };
  }, [sb, user]);

  const mine = profile?.ref_code ?? null;
  if (!user || !mine) return null;

  const n = progress?.n ?? 0;
  const pct = Math.min(100, Math.round((n / GOAL) * 100));
  const earned = Math.floor(n / GOAL);
  const canAdd = !added && !profile?.referred_by && isNew(profile?.created_at);
  const link = referralLink(mine);
  const text = `Come on ROUND with me, it picks the bar. My code is ${mine}: ${link}`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "ROUND", text, url: link });
        return;
      }
    } catch {
      /* dismissed */
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* nothing */
    }
  };

  const add = async () => {
    if (!sb || code.length < 6) return;
    setBusy(true);
    const r = await redeemReferral(sb, code);
    setBusy(false);
    setNote(redeemWords(r));
    if (r.ok) {
      setAdded(true);
      if (r.id) updateProfile({ referred_by: r.id });
    }
  };

  return (
    <section className="card mt-4 overflow-hidden p-4" data-referral data-referrals={n}>
      <p className="eyebrow" style={{ color: "var(--pine)" }}>
        Refer {GOAL} friends, get {REWARD}
      </p>
      <p className="serif mt-1" style={{ fontSize: 24, lineHeight: 1.05 }}>
        Your code is <span style={{ color: "var(--tomato)", letterSpacing: "0.06em" }} data-ref-code>{mine}</span>.
      </p>
      <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
        Send the link and the code fills in for them. {REWARD} for every ten who sign up.
      </p>
      <button onClick={() => void share()} className="pressable btn-pine mt-3 flex h-11 w-full items-center justify-center text-[14px]" data-ref-share>
        {copied ? "Link copied" : "Share your link"}
      </button>

      <div className="mt-4" data-ref-progress>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium">
            {n} of {GOAL}
            {earned > 0 && (
              <span className="ml-2 text-[12px] font-semibold" style={{ color: "var(--pine)" }}>
                {REWARD} × {earned} earned
              </span>
            )}
          </span>
          <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
            {n >= GOAL ? "We'll Venmo you." : `${GOAL - (n % GOAL)} to go`}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--ink-6)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--pine)", transition: "width 400ms" }} />
        </div>
        {progress?.names.length ? (
          <p className="mt-2 truncate text-[12.5px]" style={{ color: "var(--ink-55)" }} data-ref-names>
            {progress.names.slice(0, 6).join(", ")}
            {progress.names.length > 6 ? ` and ${progress.names.length - 6} more` : ""} joined on your code.
          </p>
        ) : (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Nobody yet. The group chat is right there.
          </p>
        )}
      </div>

      {added && note && (
        <p className="mt-4 border-t pt-3 text-[13px]" style={{ borderColor: "var(--hairline)", color: "var(--pine)" }} data-ref-added>
          {note}
        </p>
      )}
      {canAdd && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--hairline)" }} data-ref-add>
          <p className="text-[12.5px]" style={{ color: "var(--ink-55)" }}>
            Did a friend send you? Their code:
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={code}
              onChange={(e) => { setCode(cleanCode(e.target.value)); setNote(null); }}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-full border px-4 text-[15px] uppercase tracking-[0.18em] outline-none"
              style={{ background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)" }}
              data-ref-add-input
            />
            <button onClick={() => void add()} disabled={busy || code.length < 6} className="pressable btn-primary h-11 shrink-0 px-4 text-[14px]" style={{ opacity: code.length < 6 ? 0.5 : 1 }} data-ref-add-btn>
              Add
            </button>
          </div>
          {note && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-70)" }} data-ref-add-note>
              {note}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Within the first two weeks: the window for entering a friend's code. */
function isNew(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 14 * 86_400_000;
}
