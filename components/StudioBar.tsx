"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isStudio, setFlags } from "@/app/admin/actions";

/**
 * For Tim only: when this browser is signed into Studio, every venue page
 * gets a small bar with one-tap Verify and a link to the editor. Nobody else
 * ever sees it (the server checks the Studio cookie before it renders).
 */
export function StudioBar({ slug, verified }: { slug: string; verified: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isVerified, setVerified] = useState(verified);
  useEffect(() => {
    let hinted = false;
    try {
      hinted = window.localStorage.getItem("round:studio") === "1";
    } catch {
      /* ignore */
    }
    if (!hinted) return;
    isStudio().then((ok) => ok && setOn(true)).catch(() => {});
  }, []);
  if (!on) return null;
  const flip = async () => {
    setBusy(true);
    const r = await setFlags([slug], { verified: !isVerified });
    setBusy(false);
    if (r.ok) {
      setVerified(!isVerified);
      router.refresh();
    }
  };
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-[16px] px-4 py-2.5 text-[13px]" style={{ background: "var(--ink)", color: "var(--paper)" }} data-studio-bar>
      <span className="font-semibold tracking-wide">STUDIO</span>
      <span className="flex items-center gap-3">
        <button onClick={flip} disabled={busy} className="pressable rounded-full px-3 py-1 font-medium" style={{ background: isVerified ? "rgba(246,241,231,0.14)" : "var(--tomato)", color: "var(--paper)", opacity: busy ? 0.6 : 1 }}>
          {busy ? "…" : isVerified ? "Verified ✓ · undo" : "Verify: I've been"}
        </button>
        <Link href={`/admin/v/${slug}`} className="pressable underline-offset-2 hover:underline" style={{ color: "var(--on-photo-80)" }}>
          Edit
        </Link>
      </span>
    </div>
  );
}
