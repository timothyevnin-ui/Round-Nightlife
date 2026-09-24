"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { RealMap } from "@/components/RealMap";
import { TypedHeading, useTypewriter } from "@/components/QuickOnes";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import { prettyPhone } from "@/lib/phone";
import { ASKS, type Ask } from "@/lib/askQuestions";
import type { NeighborhoodId } from "@/lib/types";
import { submitRecommendation } from "./actions";

export type Offer = { open: boolean; cap: number; amount: number; approved: number };

type Step = "offer" | "name" | "where" | Ask["key"] | "pay" | "sent";
const ORDER: Step[] = ["name", "where", ...ASKS.map((a) => a.key), "pay"];

/**
 * Recommend a place, and get paid for it. The deal up front in plain words,
 * then the place, then five typed questions (words are what the AI learns
 * from), then a number and a Venmo so the $2 has somewhere to go. Ends up in
 * the Studio inbox with everything they said.
 */
export function RecommendView({ offer }: { offer: Offer }) {
  const { enabled, user, needsProfile, profile, openSignIn } = useAuth();
  const [step, setStep] = useState<Step>("offer");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"bar" | "restaurant">("bar");
  const [hood, setHood] = useState<NeighborhoodId | undefined>();
  const [address, setAddress] = useState("");
  const [words, setWords] = useState<Partial<Record<Ask["key"], string>>>({});
  const [venmo, setVenmo] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromContact, setFromContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = ORDER.indexOf(step);
  const back = () => setStep(idx > 0 ? ORDER[idx - 1] : "offer");
  const next = () => setStep(ORDER[idx + 1] ?? "pay");
  const paying = offer.open && enabled;
  const signedIn = !!user && !needsProfile;
  const left = Math.max(0, offer.cap - offer.approved);

  const send = async () => {
    setBusy(true);
    setError(null);
    const website = (document.getElementById("rec-website") as HTMLInputElement | null)?.value ?? "";
    let token: string | undefined;
    try {
      token = (await getSupabase()?.auth.getSession())?.data.session?.access_token ?? undefined;
    } catch {
      /* anonymous */
    }
    const r = await submitRecommendation({
      website,
      name,
      kind,
      neighborhood: hood,
      address,
      why: words.pitch ?? "",
      answers: {},
      words,
      venmo: paying ? venmo : undefined,
      token,
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
        {step === "offer" || step === "sent" ? (
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

      {step !== "sent" && step !== "offer" && (
        <div className="relative z-10 mt-2 flex gap-1" aria-hidden>
          {ORDER.map((s, k) => (
            <span key={s} className="block h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: k < idx ? "var(--ink)" : k === idx ? "var(--tomato)" : "var(--ink-10)" }} />
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col pt-6 pb-8">
        <AnimatePresence mode="wait">
          {step === "offer" && (
            <Screen key="offer">
              <p className="eyebrow" style={{ color: "var(--tomato)" }}>
                The deal
              </p>
              <h1 className="serif mt-2" style={{ fontSize: 38, lineHeight: 1.04, letterSpacing: "-0.02em" }} data-offer>
                {offer.open ? `We'll Venmo you $${offer.amount} for each bar you recommend that we approve of.` : "Know a spot we don't? Tell us."}
              </h1>
              <p className="mt-4 text-[15px] leading-snug" style={{ color: "var(--ink-70)" }}>
                {offer.open
                  ? `Tell us about it in your own words: five quick questions, a minute or two. Someone from ROUND goes and checks. If it makes the list, $${offer.amount} lands in your Venmo.`
                  : "Five quick questions in your own words. Someone from ROUND goes and checks every one, and if it makes the list you'll see it on Spots."}
              </p>
              {offer.open ? (
                <p className="card mt-5 px-4 py-3 text-[14px]" style={{ color: "var(--ink-70)" }} data-offer-left={left}>
                  <strong style={{ color: "var(--ink)" }}>{left.toLocaleString()}</strong> of the first {offer.cap.toLocaleString()} paid spots still open.
                </p>
              ) : (
                <p className="card mt-5 px-4 py-3 text-[14px]" style={{ color: "var(--ink-55)" }} data-offer-closed>
                  The paid spots are spoken for. Recommendations are still very welcome.
                </p>
              )}
              <NextButton onClick={() => setStep("name")} label={offer.open ? "Recommend a bar" : "Recommend a place"} />
              <p className="mt-3 text-center text-[12px]" style={{ color: "var(--ink-35)" }}>
                Bars and restaurants both count. One place per recommendation; send as many as you like.
              </p>
            </Screen>
          )}

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

          {ASKS.map(
            (a) =>
              step === a.key && (
                <Screen key={a.key}>
                  <Prompt text={a.prompt} />
                  <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                    {a.hint}
                  </p>
                  <textarea
                    value={words[a.key] ?? ""}
                    onChange={(e) => setWords((w) => ({ ...w, [a.key]: e.target.value.slice(0, 800) }))}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && (!a.required || (words[a.key] ?? "").trim().length >= 6)) next();
                    }}
                    placeholder={a.placeholder}
                    rows={5}
                    autoFocus
                    className="mt-5 w-full resize-none rounded-[18px] border p-4 text-[17px] leading-snug outline-none"
                    style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                    data-ask={a.key}
                  />
                  <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ink-35)" }}>
                    Like you&apos;d text a friend. On your phone, the mic on the keyboard works too.
                  </p>
                  <NextButton onClick={next} disabled={a.required && (words[a.key] ?? "").trim().length < 6} label={(words[a.key] ?? "").trim() ? "Next" : a.required ? "Next" : "Skip"} ghost={!(words[a.key] ?? "").trim() && !a.required} />
                </Screen>
              ),
          )}

          {step === "pay" && (
            <Screen key="pay">
              {enabled && !signedIn ? (
                <>
                  <Prompt text={paying ? "Almost. Where does the $2 go?" : "Almost. Who's this from?"} />
                  <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                    {paying ? "Adding a spot takes an account: one text, a code. It's how we know who to pay. Then your Venmo." : "Adding a spot takes an account: one text, a code. It's how we know who's telling us what, and who to thank."}
                  </p>
                  <Summary name={name} kind={kind} hood={hood} words={words} />
                  <button onClick={() => openSignIn(paying ? "recommend" : "spot")} className="pressable btn-accent mt-6 flex h-14 w-full items-center justify-center text-[16px]" data-pay-signin>
                    Add my number
                  </button>
                  <p className="mt-3 text-center text-[12px]" style={{ color: "var(--ink-35)" }}>
                    Your number is never shown to anyone. Never marketing texts.
                  </p>
                </>
              ) : paying ? (
                <>
                  <Prompt text="Your Venmo." />
                  <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                    Where the ${offer.amount} goes if {name.trim() || "it"} makes the list. Only ROUND sees it.
                  </p>
                  <label className="mt-5 flex h-16 items-center gap-1 rounded-[18px] border px-4" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)" }}>
                    <span className="serif text-[24px]" style={{ color: "var(--ink-35)" }}>
                      @
                    </span>
                    <input value={venmo} onChange={(e) => setVenmo(e.target.value.replace(/^@+/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30))} placeholder="your-venmo" autoFocus autoCapitalize="none" autoCorrect="off" className="serif min-w-0 flex-1 bg-transparent text-[24px] outline-none" style={{ color: "var(--ink)" }} data-venmo />
                  </label>
                  <Summary name={name} kind={kind} hood={hood} words={words} />
                  <input tabIndex={-1} autoComplete="off" aria-hidden className="sr-only" name="website" defaultValue="" id="rec-website" />
                  <button onClick={send} disabled={busy || venmo.length < 3} className="pressable btn-accent mt-6 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: busy || venmo.length < 3 ? 0.55 : 1 }} data-send>
                    {busy ? "Sending…" : "Send it to ROUND"}
                  </button>
                </>
              ) : signedIn ? (
                <>
                  <Prompt text={`Thanks, ${(profile?.name ?? "").trim().split(/\s+/)[0] || "you"}.`} />
                  <p className="mt-2 text-[14px]" style={{ color: "var(--ink-55)" }}>
                    We know who this is from. Send it and someone from ROUND goes to check.
                  </p>
                  <input tabIndex={-1} autoComplete="off" aria-hidden className="sr-only" name="website" defaultValue="" id="rec-website" />
                  <Summary name={name} kind={kind} hood={hood} words={words} />
                  <button onClick={send} disabled={busy} className="pressable btn-accent mt-6 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: busy ? 0.6 : 1 }} data-send>
                    {busy ? "Sending…" : "Send it to ROUND"}
                  </button>
                </>
              ) : (
                <>
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
                  <input tabIndex={-1} autoComplete="off" aria-hidden className="sr-only" name="website" defaultValue="" id="rec-website" />
                  <Summary name={name} kind={kind} hood={hood} words={words} />
                  <button onClick={send} disabled={busy} className="pressable btn-accent mt-6 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: busy ? 0.6 : 1 }} data-send>
                    {busy ? "Sending…" : "Send it to ROUND"}
                  </button>
                </>
              )}
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
                <h1 className="serif mt-6" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }} data-sent>
                  Got it.
                  <br />
                  We&apos;ll go check.
                </h1>
                <p className="mt-4 max-w-[30ch] text-[15px]" style={{ color: "var(--ink-55)" }}>
                  {paying && venmo
                    ? `Someone from ROUND goes and checks every one. If ${name.trim() || "it"} makes the list, $${offer.amount} goes to @${venmo}.`
                    : `Every place on ROUND gets checked before it goes up. If ${name.trim() || "it"} makes the cut, you'll see it on Spots.`}
                </p>
                <Link href="/" className="pressable btn-primary mt-8 flex h-14 w-full items-center justify-center text-[16px]">
                  Back to ROUND
                </Link>
                <button
                  onClick={() => {
                    setName("");
                    setHood(undefined);
                    setAddress("");
                    setWords({});
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

function Summary({ name, kind, hood, words }: { name: string; kind: string; hood?: NeighborhoodId; words: Partial<Record<Ask["key"], string>> }) {
  const said = ASKS.filter((a) => (words[a.key] ?? "").trim()).length;
  return (
    <div className="card mt-6 p-4">
      <p className="eyebrow">Sending</p>
      <p className="serif mt-1" style={{ fontSize: 22, lineHeight: 1.1 }}>
        {name.trim() || "—"}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }}>
        {kind === "restaurant" ? "Restaurant" : "Bar"}
        {hood ? ` · ${neighborhoodName(hood)}` : ""}
        {said ? ` · ${said} of ${ASKS.length} answered, in your words` : ""}
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
