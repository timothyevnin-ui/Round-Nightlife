"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setBountyOpen } from "./actions";

/**
 * The $2 offer, at a glance: on or off, how many of the first thousand are
 * approved, and who's owed. The switch closes the offer for new
 * recommendations; the ones already sent keep their promise.
 */
export function BountyCard({ open, cap, amount, approved, owed, writable }: { open: boolean; cap: number; amount: number; approved: number; owed: number; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const live = open && approved < cap;
  const flip = () =>
    start(async () => {
      setErr(null);
      const r = await setBountyOpen(!open);
      if ("error" in r) setErr(r.error);
      router.refresh();
    });
  return (
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-[13.5px]" style={{ color: "var(--ink-70)" }} data-bounty={live ? "on" : "off"}>
      <span>
        <strong>{live ? `The $${amount} offer is on.` : approved >= cap ? `The $${amount} offer is done: ${cap.toLocaleString()} approved.` : `The $${amount} offer is off.`}</strong>{" "}
        <span data-bounty-approved={approved}>
          {approved.toLocaleString()} of {cap.toLocaleString()} approved
        </span>
        {" · "}
        <Link href="/admin/suggestions?owed=1" className="underline underline-offset-2" data-bounty-owed={owed}>
          {owed} owed (${(owed * amount).toLocaleString()})
        </Link>
        .
        {err && (
          <span className="block" style={{ color: "var(--tomato)" }}>
            {err}
          </span>
        )}
      </span>
      <button onClick={flip} disabled={pending || !writable} role="switch" aria-checked={open} className="pressable flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium" style={{ borderColor: "var(--hairline-strong)", opacity: pending || !writable ? 0.5 : 1 }} aria-label={`The $${amount} offer`}>
        <span className="relative inline-block h-5 w-9 rounded-full transition-colors" style={{ background: open ? "var(--pine-bright)" : "var(--ink-20)" }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: open ? 18 : 2 }} />
        </span>
        {open ? "Paying" : "Closed"}
      </button>
    </div>
  );
}
