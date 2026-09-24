"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setVerifiedOnly } from "./actions";

/**
 * The gate. On: only verified places show in the app, and the moment you
 * verify one it's live. Off: everything researched shows too.
 */
export function VerifiedGate({ on, verified, total, writable }: { on: boolean; verified: number; total: number; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const flip = () =>
    start(async () => {
      setErr(null);
      const r = await setVerifiedOnly(!on);
      if ("error" in r) setErr(r.error);
      router.refresh();
    });
  return (
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-[13.5px]" style={{ color: "var(--ink-70)" }} data-verified-gate={on ? "on" : "off"}>
      <span>
        <strong>{on ? "Only verified places show." : "Everything shows."}</strong>{" "}
        {on ? (
          <>
            {verified} of {total} are verified; those are what people see. Verify a place and it&apos;s live within a minute.
          </>
        ) : (
          <>
            {verified} verified, {total - verified} researched-and-unvisited, all showing.
          </>
        )}
        {total - verified > 0 && (
          <>
            {" "}
            <Link href="/admin/verify" className="pressable font-medium underline underline-offset-2" style={{ color: "var(--pine)" }} data-sprint-link>
              Verify sprint: {total - verified} to go →
            </Link>
          </>
        )}
        {err && (
          <span className="block" style={{ color: "var(--tomato)" }}>
            {err}
          </span>
        )}
      </span>
      <button onClick={flip} disabled={pending || !writable} role="switch" aria-checked={on} className="pressable flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium" style={{ borderColor: "var(--hairline-strong)", opacity: pending || !writable ? 0.5 : 1 }} aria-label="Only verified places show in the app">
        <span className="relative inline-block h-5 w-9 rounded-full transition-colors" style={{ background: on ? "var(--pine-bright)" : "var(--ink-20)" }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
        </span>
        {on ? "Verified only" : "Show all"}
      </button>
    </div>
  );
}
