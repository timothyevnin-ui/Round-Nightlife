"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { neighborhoodName } from "@/lib/neighborhoods";
import { isNeighborhoodId } from "@/lib/neighborhoods";
import type { Suggestion } from "@/lib/suggestions";
import { describeSaid } from "@/lib/recommendQuestions";
import { markSuggestion } from "@/app/admin/actions";

export function Inbox({ items }: { items: Suggestion[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const mark = (id: string, status: "dismissed" | "new") =>
    start(async () => {
      const r = await markSuggestion(id, status);
      setMsg(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });

  return (
    <section className="mt-5">
      {msg && (
        <p className="mb-3 text-[12.5px]" style={{ color: "var(--tomato-deep)" }}>
          {msg}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((s) => (
          <li key={s.id} className="card p-4" style={{ opacity: s.status === "dismissed" ? 0.6 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="serif truncate" style={{ fontSize: 24, lineHeight: 1.05 }}>
                  {s.name}
                </p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                  {s.kind === "restaurant" ? "Restaurant" : "Bar"}
                  {isNeighborhoodId(s.neighborhood) ? ` · ${neighborhoodName(s.neighborhood)}` : ""}
                  {s.address ? ` · ${s.address}` : ""}
                </p>
              </div>
              <Status s={s} />
            </div>

            {s.why && (
              <p className="mt-3 text-[14.5px] leading-snug" style={{ color: "var(--ink)" }}>
                &ldquo;{s.why}&rdquo;
              </p>
            )}

            {s.answers.said && s.answers.said.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.answers.said.map((a) => {
                  const { short, answer } = describeSaid(a);
                  return (
                    <span key={a} className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: "var(--ink-6)", color: "var(--ink-70)" }} title={a}>
                      <span style={{ color: "var(--ink-35)" }}>{short} </span>
                      <strong>{answer}</strong>
                    </span>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[12px]" style={{ color: "var(--ink-35)" }}>
              {s.fromName || "Someone"}
              {s.fromContact ? ` · ${s.fromContact}` : ""} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {s.status === "added" && s.venueSlug ? (
                <>
                  {" · "}
                  <Link href={`/admin/v/${s.venueSlug}`} className="underline">
                    open the place
                  </Link>
                </>
              ) : null}
            </p>

            {s.status !== "added" && (
              <div className="mt-4 flex gap-2">
                <Link href={`/admin/new?from=${s.id}`} className="pressable btn-primary flex h-11 flex-1 items-center justify-center text-[14px]">
                  Add as a place
                </Link>
                {s.status === "new" ? (
                  <button onClick={() => mark(s.id, "dismissed")} disabled={pending} className="pressable btn-ghost flex h-11 items-center px-4 text-[13px]">
                    Not for us
                  </button>
                ) : (
                  <button onClick={() => mark(s.id, "new")} disabled={pending} className="pressable btn-ghost flex h-11 items-center px-4 text-[13px]">
                    Back to new
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Status({ s }: { s: Suggestion }) {
  const style =
    s.status === "added"
      ? { background: "var(--pine)", color: "var(--on-photo)" }
      : s.status === "dismissed"
        ? { background: "rgba(22,33,58,0.08)", color: "var(--ink-55)" }
        : { background: "var(--tomato)", color: "var(--on-photo)" };
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase" style={style}>
      {s.status === "added" ? "Added" : s.status === "dismissed" ? "Passed" : "New"}
    </span>
  );
}

