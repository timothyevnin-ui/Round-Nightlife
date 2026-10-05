"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setLineHidden } from "./actions";

export type StudioLine = { userId: string; slug: string; name: string; note: string; at: string; hidden: boolean; verdict: string | null };

/** People say, every line, newest first, with Hide / Show. */
export function Lines({ lines, names }: { lines: StudioLine[]; names: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const flip = (l: StudioLine) =>
    start(async () => {
      const r = await setLineHidden(l.userId, l.slug, !l.hidden);
      if (!r.ok) setMessage(r.message ?? "Couldn't save.");
    });
  if (!lines.length)
    return (
      <p className="mt-4 text-[14px]" style={{ color: "var(--ink-55)" }}>
        Nobody&apos;s left a line yet.
      </p>
    );
  return (
    <div>
      {message && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--tomato-deep)" }}>
          {message}
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {lines.map((l) => (
          <li key={`${l.userId}-${l.slug}`} className="card flex items-start justify-between gap-3 p-4" style={{ opacity: l.hidden ? 0.55 : 1 }} data-studio-line data-hidden={l.hidden ? "1" : "0"}>
            <div className="min-w-0">
              <p className="serif text-[17px] leading-snug">{l.note}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--ink-55)" }}>
                {l.name} · <Link href={`/v/${l.slug}`} className="underline">{names[l.slug] ?? l.slug}</Link> · {l.verdict ?? "no verdict"} · {new Date(l.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {l.hidden ? " · hidden" : ""}
              </p>
            </div>
            <button onClick={() => flip(l)} disabled={pending} className="pressable btn-ghost h-9 shrink-0 px-3.5 text-[12.5px]" data-line-flip>
              {l.hidden ? "Show" : "Hide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
