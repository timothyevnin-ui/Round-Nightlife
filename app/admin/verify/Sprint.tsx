"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { NeighborhoodId, Venue } from "@/lib/types";
import { ScoreBadge } from "@/components/Score";
import { setFlags, sprintPass, sprintVerify } from "@/app/admin/actions";

export type SprintCard = {
  slug: string;
  name: string;
  neighborhood: NeighborhoodId;
  kind: "bar" | "restaurant";
  cuisine: string | null;
  address: string;
  price: number;
  take: string;
  theCatch: string | null;
  tags: string[];
  score: number | null;
  photoUrl: string | null;
  photo: Venue["photo"];
};

type Job = {
  id: number;
  slug: string;
  name: string;
  kind: "verify" | "pass";
  status: "saving" | "done" | "error" | "undone";
  text: string;
  card: SprintCard;
};

const SCORES: { v: number; label: string }[] = [
  { v: 70, label: "Solid" },
  { v: 80, label: "Good" },
  { v: 88, label: "Great" },
  { v: 94, label: "Elite" },
  { v: 98, label: "Best" },
];

const byPlace = (a: SprintCard, b: SprintCard) => neighborhoodName(a.neighborhood).localeCompare(neighborhoodName(b.neighborhood)) || a.name.localeCompare(b.name);

/**
 * One place at a time. Been → verified (and live), your words read into the
 * fields in the background. Not for ROUND → hidden for good (undo-able).
 * Skip → back of the deck. The deck is the unverified list, neighborhood by
 * neighborhood; pick one neighborhood to walk it end to end.
 */
export function Sprint({ cards, verified, total, writable }: { cards: SprintCard[]; verified: number; total: number; writable: boolean }) {
  const [deck, setDeck] = useState<SprintCard[]>(() => [...cards].sort(byPlace));
  const [hood, setHood] = useState<string>("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [doneHere, setDoneHere] = useState({ verified: 0, passed: 0 });

  const list = useMemo(() => (hood === "all" ? deck : deck.filter((c) => c.neighborhood === hood)), [deck, hood]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of deck) m.set(c.neighborhood, (m.get(c.neighborhood) ?? 0) + 1);
    return m;
  }, [deck]);
  const current = list[0];
  const verifiedNow = verified + doneHere.verified;
  const totalNow = total - doneHere.passed;

  const pushJob = (job: Omit<Job, "id">) => {
    const id = Date.now() + Math.random();
    setJobs((j) => [{ ...job, id }, ...j].slice(0, 6));
    return id;
  };
  const patchJob = (id: number, patch: Partial<Job>) => setJobs((j) => j.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const drop = (slug: string) => setDeck((d) => d.filter((c) => c.slug !== slug));
  const putBack = (card: SprintCard) => setDeck((d) => (d.some((c) => c.slug === card.slug) ? d : [card, ...d]));

  const been = async (card: SprintCard, words: string, score: number | null) => {
    drop(card.slug);
    setDoneHere((x) => ({ ...x, verified: x.verified + 1 }));
    const id = pushJob({ slug: card.slug, name: card.name, kind: "verify", status: "saving", text: words.trim() ? "Verified. Reading your words…" : "Verifying…", card });
    const r = await sprintVerify({ slug: card.slug, words, score });
    if (!r.ok) {
      putBack(card);
      setDoneHere((x) => ({ ...x, verified: x.verified - 1 }));
      patchJob(id, { status: "error", text: r.error });
      return;
    }
    const bits: string[] = ["Verified"];
    if (score !== null) bits.push(`score ${score}`);
    if (r.learned) bits.push(`learned: ${r.learned}`);
    else if (r.changed?.length) bits.push(`filled in ${r.changed.join(", ")}`);
    if (r.readError) bits.push("couldn't read the words, so they're in the notes as said");
    patchJob(id, { status: "done", text: bits.join(" · ") + "." });
  };

  const pass = async (card: SprintCard, words: string) => {
    drop(card.slug);
    setDoneHere((x) => ({ ...x, passed: x.passed + 1 }));
    const id = pushJob({ slug: card.slug, name: card.name, kind: "pass", status: "saving", text: "Passing…", card });
    const r = await sprintPass({ slug: card.slug, words });
    if (!r.ok) {
      putBack(card);
      setDoneHere((x) => ({ ...x, passed: x.passed - 1 }));
      patchJob(id, { status: "error", text: r.error });
      return;
    }
    patchJob(id, { status: "done", text: "Not for ROUND. Hidden everywhere; the list under Places → Not for ROUND has it." });
  };

  const skip = (card: SprintCard) => setDeck((d) => [...d.filter((c) => c.slug !== card.slug), card]);

  const undo = async (job: Job) => {
    patchJob(job.id, { status: "saving", text: "Undoing…" });
    const r = await setFlags([job.slug], job.kind === "verify" ? { verified: false } : { retired: false });
    if (!r.ok) return patchJob(job.id, { status: "error", text: r.error });
    putBack(job.card);
    setDoneHere((x) => (job.kind === "verify" ? { ...x, verified: x.verified - 1 } : { ...x, passed: x.passed - 1 }));
    patchJob(job.id, { status: "undone", text: job.kind === "verify" ? "Un-verified; it's back in the deck." : "Brought back; it's back in the deck." });
  };

  return (
    <main className="screen pb-16 pt-6" data-sprint>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Verify sprint</p>
          <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }} data-sprint-left={list.length}>
            {list.length === 0 ? "All caught up." : `${list.length} to go${hood === "all" ? "" : ` in ${neighborhoodName(hood as NeighborhoodId)}`}.`}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }} data-sprint-tally>
            {doneHere.verified} verified this sprint{doneHere.passed ? `, ${doneHere.passed} passed on` : ""} · {verifiedNow} of {totalNow} verified overall.
          </p>
        </div>
        <select value={hood} onChange={(e) => setHood(e.target.value)} className="h-11 rounded-full border px-3 text-[13.5px]" style={inputStyle} aria-label="Neighborhood">
          <option value="all">All neighborhoods ({deck.length})</option>
          {NEIGHBORHOODS.filter((n) => counts.get(n.id)).map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({counts.get(n.id)})
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(22,33,58,0.08)" }} aria-hidden>
        <div className="h-full rounded-full transition-all" style={{ width: `${totalNow ? Math.round((verifiedNow / totalNow) * 100) : 0}%`, background: "var(--pine-bright)" }} />
      </div>

      {!writable && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--tomato)" }}>
          Read-only until the database is connected and the list is imported (Studio → Dashboard).
        </p>
      )}

      {jobs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5" data-sprint-jobs>
          {jobs.slice(0, 4).map((j) => (
            <li key={j.id} className="flex items-start justify-between gap-3 rounded-[14px] px-3.5 py-2 text-[12.5px]" style={{ background: j.status === "error" ? "rgba(216,74,44,0.10)" : "var(--surface)", color: j.status === "error" ? "var(--tomato)" : "var(--ink-70)" }} data-job-status={j.status}>
              <span className="min-w-0">
                <strong style={{ color: j.status === "error" ? "var(--tomato)" : "var(--ink)" }}>{j.name}</strong> {j.status === "saving" ? <span className="animate-pulse">{j.text}</span> : j.text}
              </span>
              {j.status === "done" && (
                <button onClick={() => undo(j)} className="pressable shrink-0 underline-offset-2 hover:underline" style={{ color: "var(--ink-55)" }} data-job-undo>
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {current ? (
        <Card key={current.slug} card={current} disabled={!writable} onBeen={(w, s) => been(current, w, s)} onPass={(w) => pass(current, w)} onSkip={() => skip(current)} />
      ) : (
        <div className="card mt-6 px-5 py-8 text-center" data-sprint-empty>
          <p className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
            {deck.length === 0 ? "Every place is verified or passed on." : `Nothing left in ${neighborhoodName(hood as NeighborhoodId)}.`}
          </p>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            {deck.length === 0 ? "Add a place and it lands here until you've been." : "Pick another neighborhood above, or walk all of them."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {deck.length > 0 && (
              <button onClick={() => setHood("all")} className="pressable btn-pine h-11 px-5 text-[14px]">
                All neighborhoods
              </button>
            )}
            <Link href="/admin/add" className="pressable btn-primary flex h-11 items-center px-5 text-[14px]">
              + Add a place
            </Link>
          </div>
        </div>
      )}

      {list.length > 1 && (
        <p className="mt-4 text-[12.5px]" style={{ color: "var(--ink-35)" }} data-sprint-next>
          Up next: {list.slice(1, 4).map((c) => c.name).join(" · ")}
          {list.length > 4 ? ` · ${list.length - 4} more` : ""}
        </p>
      )}
    </main>
  );
}

/** One place's card. Keyed by slug, so its words and score start fresh for each place. */
function Card({ card, disabled, onBeen, onPass, onSkip }: { card: SprintCard; disabled: boolean; onBeen: (words: string, score: number | null) => void; onPass: (words: string) => void; onSkip: () => void }) {
  const [words, setWords] = useState("");
  const [score, setScore] = useState<number | null>(null); // null = leave the score as it is
  const [custom, setCustom] = useState("");
  const gradient = `linear-gradient(${card.photo.angle ?? 180}deg, ${card.photo.from}, ${card.photo.to})`;
  return (
    <section className="card mt-5 overflow-hidden" data-sprint-card={card.slug}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px]" style={{ background: gradient }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {card.photoUrl && <img src={card.photoUrl} alt="" className="h-full w-full object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="serif truncate" style={{ fontSize: 28, lineHeight: 1.05 }}>
            {card.name}
          </h2>
          <p className="truncate text-[13px]" style={{ color: "var(--ink-55)" }}>
            {neighborhoodName(card.neighborhood)} · {card.kind === "restaurant" ? "Restaurant" : "Bar"}
            {card.cuisine ? ` · ${card.cuisine}` : ""} · {"$".repeat(card.price)}
            {card.address ? ` · ${card.address.replace(/,?\s*(New York|NY|Brooklyn|Manhattan)\b.*$/i, "")}` : ""}
          </p>
        </div>
        <ScoreBadge score={card.score ?? undefined} size={44} />
      </div>

      <div className="mx-4 mt-4 rounded-[14px] px-3.5 py-3 text-[13.5px]" style={{ background: "rgba(22,33,58,0.05)" }} data-sprint-known>
        <p className="eyebrow" style={{ fontSize: 10.5 }}>
          What we have
        </p>
        <p className="mt-1" style={{ color: "var(--ink)" }}>
          {card.take || "Nothing written yet."}
        </p>
        {card.theCatch && (
          <p className="mt-1" style={{ color: "var(--ink-70)" }}>
            {card.theCatch}
          </p>
        )}
        {card.tags.length > 0 && (
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-55)" }}>
            {card.tags.join(" · ")}
          </p>
        )}
      </div>

      <div className="px-4 pt-4">
        <label className="block text-[13px] font-medium" htmlFor={`words-${card.slug}`}>
          Say it, any tone. <span style={{ color: "var(--ink-35)" }}>Or leave it blank and just verify.</span>
        </label>
        <textarea
          id={`words-${card.slug}`}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) onBeen(words, score);
          }}
          rows={3}
          maxLength={1200}
          placeholder="Went Friday. $9 beers, DJ after 11, booth in the back, packed by 10, bartender knows everyone."
          className="mt-1.5 w-full resize-none rounded-[14px] border px-3.5 py-3 text-[15px] outline-none"
          style={inputStyle}
          data-sprint-words
        />
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--ink-35)" }}>
          On your phone, tap the mic on the keyboard and talk. Every word lands in this place&apos;s notes, dated; the fields fill in from it.
        </p>
      </div>

      <div className="px-4 pt-3">
        <p className="text-[13px] font-medium">ROUND&apos;s score</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="ROUND's score" data-sprint-scores>
          <Chip on={score === null} onClick={() => { setScore(null); setCustom(""); }} label={card.score !== null ? `Keep ${card.score}` : "No score"} />
          {SCORES.map((s) => (
            <Chip key={s.v} on={score === s.v} onClick={() => { setScore(s.v); setCustom(""); }} label={`${s.v}`} sub={s.label} />
          ))}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              setScore(e.target.value !== "" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null);
            }}
            placeholder="…"
            aria-label="Custom score"
            className="h-10 w-14 shrink-0 rounded-full border text-center text-[13.5px] outline-none"
            style={{ ...inputStyle, borderColor: custom ? "var(--tomato)" : inputStyle.borderColor }}
            data-sprint-score
          />
        </div>
      </div>

      <div className="px-4 pb-4 pt-4">
        <button onClick={() => onBeen(words, score)} disabled={disabled} className="pressable btn-primary h-14 w-full text-[16px] font-semibold" data-sprint-been>
          Been — it&apos;s ROUND ✓
        </button>
        <div className="mt-2 flex gap-2">
          <button onClick={() => onPass(words)} disabled={disabled} className="pressable btn-ghost h-11 flex-1 text-[14px]" style={{ color: "var(--tomato)" }} data-sprint-pass>
            Not for ROUND
          </button>
          <button onClick={onSkip} className="pressable btn-ghost h-11 flex-1 text-[14px]" data-sprint-skip>
            Skip for now
          </button>
        </div>
        <p className="mt-3 text-center text-[12px]" style={{ color: "var(--ink-35)" }}>
          <Link href={`/admin/v/${card.slug}`} className="pressable underline-offset-2 hover:underline">
            Open the full editor
          </Link>
          {" · "}
          <Link href={`/v/${card.slug}`} className="pressable underline-offset-2 hover:underline">
            See its page
          </Link>
        </p>
      </div>
    </section>
  );
}

function Chip({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className="pressable flex h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-[13.5px]" style={on ? { background: "var(--tomato)", borderColor: "var(--tomato)", color: "var(--on-photo)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink)" }}>
      <span className="font-semibold">{label}</span>
      {sub && (
        <span className="text-[11px]" style={{ opacity: 0.8 }}>
          {sub}
        </span>
      )}
    </button>
  );
}

const inputStyle = { background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" } as const;
