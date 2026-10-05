"use client";

import { useState, useTransition } from "react";
import type { CrowdQuestion } from "@/lib/crowdQuestions";
import { refreshPool, rewordQuestion, setQuestionActive } from "./actions";

/**
 * The question pool, in Studio: every question the rating sheet can ask,
 * what it came from, how many answers it has, and the buttons: Refresh from
 * the asks (the AI rewrites the pool), Retire, Bring back, Reword.
 */
export function Pool({ pool, answered, hasTable, names }: { pool: CrowdQuestion[]; answered: Record<string, number>; hasTable: boolean; names: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sub, setSub] = useState("");

  const refresh = () =>
    start(async () => {
      const r = await refreshPool();
      setMessage(r.message);
    });
  const flip = (q: CrowdQuestion) =>
    start(async () => {
      const r = await setQuestionActive(q.id, !q.active);
      if (!r.ok) setMessage(r.message ?? "Couldn't save.");
    });
  const save = (q: CrowdQuestion) =>
    start(async () => {
      const r = await rewordQuestion(q.id, prompt, sub);
      if (!r.ok) setMessage(r.message ?? "Couldn't save.");
      else setEditing(null);
    });

  const best = pool.filter((q) => q.role === "best");
  const general = pool.filter((q) => q.role === "ask" && !q.slug);
  const perPlace = pool.filter((q) => q.role === "ask" && q.slug);

  const Row = ({ q }: { q: CrowdQuestion }) => (
    <li className="card p-4" style={{ opacity: q.active ? 1 : 0.55 }} data-question={q.id} data-active={q.active ? "1" : "0"}>
      {editing === q.id ? (
        <div className="flex flex-col gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full rounded-[14px] border px-3 py-2 text-[15px]" style={{ borderColor: "var(--hairline-strong)", background: "var(--paper)" }} maxLength={90} data-reword-prompt />
          <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="A second line (optional)" className="w-full rounded-[14px] border px-3 py-2 text-[13px]" style={{ borderColor: "var(--hairline-strong)", background: "var(--paper)" }} maxLength={90} />
          <div className="flex gap-2">
            <button onClick={() => save(q)} disabled={pending || !prompt.trim()} className="pressable btn-primary h-10 px-4 text-[13px]" data-reword-save>
              Save
            </button>
            <button onClick={() => setEditing(null)} className="pressable btn-ghost h-10 px-4 text-[13px]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="serif text-[19px] leading-tight">{q.prompt}</p>
              {q.sub && (
                <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                  {q.sub}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ink-35)" }}>
              {q.slug ? names[q.slug] ?? q.slug : q.kind === "both" ? "bars & restaurants" : `${q.kind}s`}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {q.options.map((o) => (
              <span key={o.key} className="rounded-full border px-2.5 py-1 text-[12px]" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }} title={Object.entries(o.attrs ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "no traits"}>
                {o.label}
                {o.badge ? ` · "${o.badge}"` : ""}
              </span>
            ))}
          </p>
          <p className="mt-2 text-[12px]" style={{ color: "var(--ink-55)" }}>
            demand {q.demand.toFixed(1)} · {answered[q.id] ?? 0} answered · {q.multi ? "pick any" : "pick one"} · {q.ai ? "written by the AI" : "your words"}
            {q.from ? ` · from: ${q.from}` : ""}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => flip(q)} disabled={pending || !hasTable} className="pressable btn-ghost h-9 px-3.5 text-[12.5px]" data-flip>
              {q.active ? "Retire" : "Bring back"}
            </button>
            <button
              onClick={() => {
                setEditing(q.id);
                setPrompt(q.prompt);
                setSub(q.sub ?? "");
              }}
              disabled={pending || !hasTable}
              className="pressable btn-ghost h-9 px-3.5 text-[12.5px]"
              data-reword
            >
              Reword
            </button>
          </div>
        </>
      )}
    </li>
  );

  return (
    <div>
      <div className="card mt-4 p-4">
        <p className="text-[14px] leading-snug" style={{ color: "var(--ink-70)" }}>
          The AI reads what people typed into Just say it and searched for, and rewrites this pool so the rating sheet asks what the city asks for. It also runs on its own every fifty asks.
        </p>
        <button onClick={refresh} disabled={pending || !hasTable} className="pressable btn-primary mt-3 h-11 px-5 text-[14px]" data-refresh-pool>
          {pending ? "Reading the asks…" : "Refresh from the asks"}
        </button>
        {message && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--ink-70)" }} data-pool-message>
            {message}
          </p>
        )}
        {!hasTable && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--tomato-deep)" }}>
            The crowd_questions table isn&apos;t there yet: run the latest schema.sql. Until then the seed pool asks.
          </p>
        )}
      </div>

      <p className="eyebrow mt-7">Best for</p>
      <ul className="mt-2 flex flex-col gap-3">
        {best.map((q) => (
          <Row key={q.id} q={q} />
        ))}
      </ul>
      <p className="eyebrow mt-7">What ROUND asks</p>
      <ul className="mt-2 flex flex-col gap-3">
        {general.map((q) => (
          <Row key={q.id} q={q} />
        ))}
      </ul>
      {perPlace.length > 0 && (
        <>
          <p className="eyebrow mt-7">Written for one place</p>
          <ul className="mt-2 flex flex-col gap-3">
            {perPlace.map((q) => (
              <Row key={q.id} q={q} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
