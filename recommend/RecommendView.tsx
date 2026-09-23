"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { RealMap } from "@/components/RealMap";
import { TypedHeading, useTypewriter } from "@/components/QuickOnes";
import { useAuth } from "@/lib/auth";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import { prettyPhone } from "@/lib/phone";
import { applyRecAnswer, REC_QUESTIONS } from "@/lib/recommendQuestions";
import type { SuggestionAnswers } from "@/lib/suggestions";
import type { NeighborhoodId } from "@/lib/types";
import { submitRecommendation } from "./actions";

type Step = "name" | "where" | "quick" | "why" | "you" | "sent";
const ORDER: Step[] = ["name", "where", "quick", "why", "you"];

/**
 * Recommend a place. Same rhythm as the app: one thing per screen, the
 * question types itself, buttons answer it. Ends up in the back-office inbox.
 */
export function RecommendView() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"bar" | "restaurant">("bar");
  const [hood, setHood] = useState<NeighborhoodId | undefined>();
  const [address, setAddress] = useState("");
  const [answers, setAnswers] = useState<SuggestionAnswers>({});
  const [why, setWhy] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromContact, setFromContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = ORDER.indexOf(step);
  const back = () => setStep(idx > 0 ? ORDER[idx - 1] : "name");
  const next = () => setStep(ORDER[idx + 1] ?? "you");

  const send = async () => {
    setBusy(true);
    setError(null);
    const website = (document.getElementById("rec-website") as HTMLInputElement | null)?.value ?? "";
    const r = await submitRecommendation({
      website,
      name,
      kind,
      neighborhood: hood,
      address,
      why,
      answers,
      fromName: fromName || profile?.name || "",
      fromContact: fromContact || (profile?.phone ? prettyPhone(profile.phone) : ""),
    });
    setBusy(false);
    if (r.ok) setStep("sent");
    else setError(r.error);
  };

  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ minHeight: "100dvh" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 55% at 50% -10%, rgba(31,74,60,0.22), transparent 70%)" }} />
      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        {step === "name" || step === "sent" ? (
          <Link href="/" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
            <BackIcon />
          </Link>
        ) : (
          <button onClick={back} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
            <BackIcon />
          </button>
        )}
        <span className="eyebrow">Recommend a place</span>
        <Link href="/" className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      {step !== "sent" && (
        <div className="relative z-10 mt-2 flex gap-1" aria-hidden>
          {ORDER.map((s, k) => (
            <span key={s} className="block h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: k < idx ? "var(--ink)" : k === idx ? "var(--tomato)" : "var(--ink-10)" }} />
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col pt-6 pb-8">
        <AnimatePresence mode="wait">
          {step === "name" && (
            <Screen key="name">
              <Prompt text="What's the place?" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && next()}
                placeholder="The name"
                autoFocus
                className="serif mt-6 w-full rounded-[18px] border px-4 text-[24px] outline-none"
                style={{ height: 64, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["bar", "restaurant"] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className="pressable flex h-12 items-center justify-center rounded-full border text-[15px] font-semibold" style={kind === k ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline-strong)" }}>
                    {k === "bar" ? "A bar" : "A restaurant"}
                  </button>
                ))}
              </div>
              <NextButton disabled={name.trim().length < 2} onClick={next} />
            </Screen>
          )}

          {step === "where" && (
            <Screen key="where">
              <Prompt text="Where is it?" />
              <div className="mt-5 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--hairline)", background: "var(--paper-2)" }}>
                <RealMap value={hood} onSelect={setHood} height={300} />
              </div>
              <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
                {NEIGHBORHOODS.map((n) => (
                  <button key={n.id} onClick={() => setHood(n.id)} className="pressable flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium" style={hood === n.id ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" }}>
                    {n.short}
                  </button>
                ))}
              </div>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address or cross streets (optional)"
                className="mt-4 w-full rounded-[16px] border px-4 text-[15px] outline-none"
                style={{ height: 52, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
              <NextButton onClick={next} label={hood ? `It's in ${neighborhoodName(hood)}` : "Not sure, skip"} ghost={!hood} />
            </Screen>
          )}

          {step === "quick" && (
            <Screen key="quick">
              <Quick
                answers={answers}
                onChange={setAnswers}
                onDone={() => setStep("why")}
              />
            </Screen>
          )}

          {step === "why" && (
            <Screen key="why">
              <Prompt text="What's the move there?" />
              <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                One line. What you&apos;d text a friend.
              </p>
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value.slice(0, 600))}
                placeholder="Go Tuesday, sit at the bar, order the…"
                rows={4}
                autoFocus
                className="mt-5 w-full resize-none rounded-[18px] border p-4 text-[17px] leading-snug outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
              <NextButton onClick={next} label={why.trim() ? "Next" : "Skip"} ghost={!why.trim()} />
            </Screen>
          )}

          {step === "you" && (
            <Screen key="you">
              <Prompt text="Who's this from?" />
              <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                Optional. So we can say thanks if it makes the cut.
              </p>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder={profile?.name || "Your name"}
                className="mt-5 w-full rounded-[16px] border px-4 text-[16px] outline-none"
                style={{ height: 54, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
              <input
                value={fromContact}
                onChange={(e) => setFromContact(e.target.value)}
                placeholder={profile?.phone ? prettyPhone(profile.phone) : "Instagram or phone"}
                className="mt-3 w-full rounded-[16px] border px-4 text-[16px] outline-none"
                style={{ height: 54, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
              />
              {/* Honeypot: hidden from people, filled by bots. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden className="sr-only" name="website" defaultValue="" id="rec-website" />
              <Summary name={name} kind={kind} hood={hood} answers={answers} />
              <button onClick={send} disabled={busy} className="pressable btn-accent mt-6 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: busy ? 0.6 : 1 }}>
                {busy ? "Sending…" : "Send it to ROUND"}
              </button>
              {error && (
                <p className="mt-3 text-[13.5px]" style={{ color: "var(--tomato-deep)" }} role="alert">
                  {error}
                </p>
              )}
            </Screen>
          )}

          {step === "sent" && (
            <Screen key="sent">
              <div className="flex flex-1 flex-col items-center justify-center pt-10 text-center">
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="ring-mark" style={{ width: 44, height: 44, borderWidth: 4 }} />
                <h1 className="serif mt-6" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
                  Got it.
                  <br />
                  We&apos;ll go check.
                </h1>
                <p className="mt-4 max-w-[28ch] text-[15px]" style={{ color: "var(--ink-55)" }}>
                  Every place on ROUND gets a visit before it goes up. If {name.trim() || "it"} makes the cut, you&apos;ll see it on the shelf.
                </p>
                <Link href="/" className="pressable btn-primary mt-8 flex h-14 w-full items-center justify-center text-[16px]">
                  Back to ROUND
                </Link>
                <button
                  onClick={() => {
                    setName("");
                    setHood(undefined);
                    setAddress("");
                    setAnswers({});
                    setWhy("");
                    setStep("name");
                  }}
                  className="pressable mt-4 text-[14px] font-medium"
                  style={{ color: "var(--ink-55)" }}
                >
                  Recommend another
                </button>
              </div>
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ───────────────────────── the quick ones ───────────────────────── */

function Quick({ answers, onChange, onDone }: { answers: SuggestionAnswers; onChange: (a: SuggestionAnswers) => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const q = REC_QUESTIONS[i];

  const pick = (k: number) => {
    if (!q) return;
    onChange(applyRecAnswer(answers, q, k));
    if (i + 1 >= REC_QUESTIONS.length) window.setTimeout(onDone, 220);
    setI(i + 1);
  };
  const skip = () => {
    if (i + 1 >= REC_QUESTIONS.length) window.setTimeout(onDone, 120);
    setI(i + 1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Quick ones · about the place</p>
        <span className="text-[12px] font-medium" style={{ color: "var(--ink-35)" }}>
          {Math.min(i + 1, REC_QUESTIONS.length)} of {REC_QUESTIONS.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          {q ? (
            <RecQ key={q.id} prompt={q.prompt} labels={q.options.map((o) => o.label)} onPick={pick} />
          ) : (
            <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-center" style={{ fontSize: 34 }}>
              Got it.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={skip} disabled={!q} className="pressable text-[13px] font-medium" style={{ color: "var(--ink-35)" }}>
          Not sure, skip
        </button>
        <button onClick={onDone} className="pressable btn-ghost flex h-11 items-center px-5 text-[14px]">
          That&apos;s enough
        </button>
      </div>
    </div>
  );
}

function RecQ({ prompt, labels, onPick }: { prompt: string; labels: string[]; onPick: (k: number) => void }) {
  const typed = useTypewriter(prompt);
  const ready = typed.length >= prompt.length;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }}>
      <TypedHeading text={prompt} typed={typed} ready={ready} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 8 }} transition={{ duration: 0.25 }} className={`mt-8 grid gap-3 ${labels.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ pointerEvents: ready ? "auto" : "none" }}>
        {labels.map((l, k) => (
          <button key={l} onClick={() => onPick(k)} className="pressable min-w-[100px] flex h-16 items-center justify-center rounded-full border px-3 text-[17px] font-semibold" style={k === 0 ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline-strong)" }}>
            {l}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col">
      {children}
    </motion.section>
  );
}

function Prompt({ text }: { text: string }) {
  const typed = useTypewriter(text);
  return <TypedHeading text={text} typed={typed} ready={typed.length >= text.length} size={40} />;
}

function NextButton({ onClick, disabled, label = "Next", ghost }: { onClick: () => void; disabled?: boolean; label?: string; ghost?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`pressable mt-6 flex h-14 w-full items-center justify-center text-[16px] ${ghost ? "btn-ghost" : "btn-primary"}`} style={{ opacity: disabled ? 0.45 : 1 }}>
      {label}
    </button>
  );
}

function Summary({ name, kind, hood, answers }: { name: string; kind: string; hood?: NeighborhoodId; answers: SuggestionAnswers }) {
  const said = (answers.said ?? []).map((s) => s.slice(s.lastIndexOf("? ") + 2));
  return (
    <div className="card mt-6 p-4">
      <p className="eyebrow">Sending</p>
      <p className="serif mt-1" style={{ fontSize: 22, lineHeight: 1.1 }}>
        {name.trim() || "—"}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }}>
        {kind === "restaurant" ? "Restaurant" : "Bar"}
        {hood ? ` · ${neighborhoodName(hood)}` : ""}
        {said.length ? ` · ${said.slice(0, 6).join(" · ")}` : ""}
      </p>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
