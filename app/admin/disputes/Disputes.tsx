"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveDispute } from "@/app/admin/actions";
import { aboutLabel } from "@/lib/disputeAbouts";
import type { Dispute } from "@/lib/disputes";

export type DisputeCard = Dispute & { name: string; take: string; kind: "bar" | "restaurant" };

export function Disputes({ items, writable, problem }: { items: DisputeCard[]; writable: boolean; problem?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [only, setOnly] = useState<"new" | "all">("new");
  // Cards you resolve on this visit stay put, with the result under them, until you leave.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const open = items.filter((d) => d.status === "new");
  const list = only === "new" ? items.filter((d) => d.status === "new" || touched.has(d.id)) : items;

  const resolve = (id: string, verdict: "confirmed" | "declined") => {
    setBusy(id);
    setTouched((t) => new Set(t).add(id));
    start(async () => {
      const r = await resolveDispute(id, verdict);
      setBusy(null);
      if (!r.ok) return setNotes((n) => ({ ...n, [id]: r.error }));
      setNotes((n) => ({ ...n, [id]: verdict === "declined" ? "Filed. Nothing changed." : `ROUND agreed${r.learned ? `, and learned: ${r.learned}` : r.changed?.length ? `, and filled in ${r.changed.join(", ")}` : ""}.${r.readError ? " (The words are in the notes; the AI couldn't read them just now.)" : ""}` }));
      router.refresh();
    });
  };

  return (
    <main className="screen pb-16 pt-6" data-disputes>
      <p className="eyebrow">Disagreements</p>
      <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }} data-disputes-open={open.length}>
        {open.length === 0 ? "Nothing waiting." : `${open.length} waiting.`}
      </h1>
      <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
        What readers say we got wrong, in their words. <strong>Confirm</strong> and the AI reads it into the place: the algorithm, tags, food, price, room, hours. The take stays yours. <strong>Not quite</strong> just files it.
      </p>
      {problem && (
        <p className="card mt-4 px-4 py-3 text-[13px]" style={{ color: "var(--tomato)" }}>
          {problem}
        </p>
      )}
      {!writable && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
          Read-only until the database is connected.
        </p>
      )}
      <div className="mt-4 flex gap-1.5">
        <button onClick={() => setOnly("new")} className="pressable h-9 rounded-full border px-3 text-[13px] font-medium" style={only === "new" ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)" }}>
          Waiting ({open.length})
        </button>
        <button onClick={() => setOnly("all")} className="pressable h-9 rounded-full border px-3 text-[13px] font-medium" style={only === "all" ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)" }}>
          Everything ({items.length})
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {list.map((d) => (
          <li key={d.id} className="card p-4" style={{ opacity: d.status === "declined" ? 0.6 : 1 }} data-dispute={d.id} data-dispute-status={d.status}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/v/${d.slug}`} className="serif block truncate underline-offset-2 hover:underline" style={{ fontSize: 24, lineHeight: 1.05 }}>
                  {d.name}
                </Link>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                  {d.fromName ?? "Someone"} · {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {aboutLabel(d.about) ? ` · ${aboutLabel(d.about)}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={d.status === "confirmed" ? { background: "var(--pine)", color: "var(--on-photo)" } : d.status === "declined" ? { background: "rgba(22,33,58,0.08)", color: "var(--ink-55)" } : { background: "var(--tomato)", color: "var(--on-photo)" }}>
                {d.status === "new" ? "Waiting" : d.status === "confirmed" ? "Agreed" : "Filed"}
              </span>
            </div>
            <p className="mt-3 text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
              We say: &ldquo;{d.take}&rdquo;
            </p>
            <p className="serif mt-2 text-[19px] leading-snug" data-dispute-text>
              &ldquo;{d.text}&rdquo;
            </p>
            {d.status === "confirmed" && d.learned && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--pine)" }}>
                Learned: {d.learned}
              </p>
            )}
            {notes[d.id] && (
              <p className="mt-2 text-[13px]" style={{ color: /Filed/.test(notes[d.id]) ? "var(--ink-55)" : /agreed/.test(notes[d.id]) ? "var(--pine)" : "var(--tomato)" }} data-dispute-note>
                {notes[d.id]}
              </p>
            )}
            {d.status === "new" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => resolve(d.id, "confirmed")} disabled={!writable || (pending && busy === d.id)} className="pressable btn-pine h-10 flex-1 text-[13.5px]" data-dispute-confirm>
                  {busy === d.id ? "Reading…" : "They're right: learn it"}
                </button>
                <button onClick={() => resolve(d.id, "declined")} disabled={!writable || (pending && busy === d.id)} className="pressable btn-ghost h-10 px-4 text-[13.5px]" data-dispute-decline>
                  Not quite
                </button>
              </div>
            )}
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-8 text-center text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            {only === "new" ? "Nobody's disagreed with you lately." : "Nothing here yet. The Disagree button lives on the Spots tab."}
          </li>
        )}
      </ul>
    </main>
  );
}
