"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth, type SignInReason } from "@/lib/auth";
import { AboutYou } from "./AboutYou";
import { ageOn, formatUS, prettyPhone, toE164 } from "@/lib/phone";

/**
 * The sign-in sheet. Phone → six-digit code → (first time) name and birthday →
 * a few quick ones about you (photo, hometown, favorites; all skippable).
 * Always skippable: ROUND never holds the three picks hostage.
 */

const COPY: Record<SignInReason, { title: string; sub: string }> = {
  keep: { title: "Keep this.", sub: "Add your number and everything you save follows you: new phone, laptop, next year." },
  you: { title: "Keep your map.", sub: "Right now it lives on this phone only. Your number makes it yours." },
  rate: { title: "Keep your ladder.", sub: "Your ratings are the start of your ranked NYC. Don't lose them to a new phone." },
  menu: { title: "Sign in.", sub: "Your number, a code, done." },
  friends: { title: "Find your friends.", sub: "Your number is how they find you, and how you find them. One text, a code, done." },
};

type Step = "phone" | "code" | "profile" | "about" | "done";

export function SignInSheet() {
  const auth = useAuth();
  const { enabled, sheetOpen, reason, closeSignIn, user, needsProfile, profile } = auth;
  if (!enabled) return null;
  return (
    <AnimatePresence>
      {sheetOpen && (
        <Sheet key="signin" onClose={closeSignIn}>
          <Flow reason={reason} startAt={user ? (needsProfile ? "profile" : "done") : "phone"} name={profile?.name} />
        </Sheet>
      )}
    </AnimatePresence>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[28px] border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--chalk-20)" }} />
        {children}
      </motion.div>
    </motion.div>
  );
}

function Flow({ reason, startAt, name: existingName }: { reason: SignInReason; startAt: Step; name?: string }) {
  const { sendCode, verifyCode, saveProfile, signOut, closeSignIn, user, needsProfile, profile } = useAuth();
  const [step, setStep] = useState<Step>(startAt);
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string>(user?.phone ? `+${user.phone.replace(/^\+/, "")}` : "");
  const [code, setCode] = useState("");
  const [name, setName] = useState(existingName ?? "");
  const [bd, setBd] = useState({ m: "", d: "", y: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [underage, setUnderage] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  // A returning person already has a name and birthday: the profile step
  // resolves straight to done, with the name the account already knows.
  const returning = step === "profile" && !!user && !needsProfile;
  const shown: Step = returning ? "done" : step;
  const shownName = returning ? (profile?.name ?? "") : name;

  useEffect(() => {
    if (shown !== "done") return;
    const t = window.setTimeout(closeSignIn, 1400);
    return () => window.clearTimeout(t);
  }, [shown, closeSignIn]);

  const e164 = toE164(phoneInput);

  const send = async (target: string | null = e164) => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    const err = await sendCode(target);
    setBusy(false);
    if (err) return setError(err);
    setPhone(target);
    setCode("");
    setStep("code");
    setResendIn(30);
    window.setTimeout(() => codeRef.current?.focus(), 250);
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(phone, value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
      codeRef.current?.focus();
      return;
    }
    // AuthProvider now knows the user; profile presence decides the next step.
    setStep("profile");
  };

  const finish = async () => {
    if (busy) return;
    const birthday = `${bd.y.padStart(4, "0")}-${bd.m.padStart(2, "0")}-${bd.d.padStart(2, "0")}`;
    const age = ageOn(birthday);
    if (!name.trim()) return setError("What should we call you?");
    if (age === null) return setError("That birthday doesn't look right.");
    if (age < 21) {
      setUnderage(true);
      await signOut({ forget: true });
      return;
    }
    setBusy(true);
    setError(null);
    const err = await saveProfile({ name, birthday });
    setBusy(false);
    if (err) return setError(err);
    // First time in: a few quick ones (photo, where you're from, favorites). Every one skippable.
    setStep("about");
  };

  if (underage) {
    return (
      <>
        <p className="eyebrow">Sorry</p>
        <h2 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          ROUND is for 21 and over.
        </h2>
        <p className="mt-3 text-[14px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          Come back on your birthday. We&apos;ll have a place for you.
        </p>
        <button onClick={closeSignIn} className="pressable btn-ghost mt-5 flex h-12 w-full items-center justify-center text-[14px]">
          Okay
        </button>
      </>
    );
  }

  if (shown === "phone") {
    const c = COPY[reason];
    return (
      <>
        <p className="eyebrow">Your number</p>
        <h2 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          {c.title}
        </h2>
        <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          {c.sub}
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-[18px] border px-4" style={{ background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", height: 60 }}>
          {!phoneInput.trim().startsWith("+") && (
            <span className="text-[20px]" style={{ color: "var(--chalk-35)" }}>
              +1
            </span>
          )}
          <input
            autoFocus
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            name="phone"
            value={formatUS(phoneInput)}
            onChange={(e) => {
              // Backspacing over a ")" or a space should eat the digit before it,
              // otherwise the formatter puts the punctuation straight back.
              const next = e.target.value;
              const prev = formatUS(phoneInput);
              const digits = next.replace(/\D/g, "");
              const shrank = next.length < prev.length && digits === prev.replace(/\D/g, "") && !next.startsWith("+");
              setPhoneInput(shrank ? digits.slice(0, -1) : next);
            }}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="(212) 555-0123"
            className="w-full bg-transparent text-[22px] outline-none"
            style={{ color: "var(--chalk)", letterSpacing: "0.02em" }}
          />
        </div>
        {error && <Err>{error}</Err>}
        <button onClick={() => send()} disabled={!e164 || busy} className="pressable btn-primary mt-4 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: !e164 || busy ? 0.55 : 1 }}>
          {busy ? "Sending…" : "Text me a code"}
        </button>
        <button onClick={closeSignIn} className="pressable mt-3 flex h-10 w-full items-center justify-center text-[14px]" style={{ color: "var(--chalk-55)" }}>
          Not now
        </button>
        <p className="mt-2 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--chalk-35)" }}>
          One text with a code. Never marketing texts. 21+ only.
        </p>
      </>
    );
  }

  if (shown === "code") {
    return (
      <>
        <p className="eyebrow">Check your texts</p>
        <h2 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          Six digits.
        </h2>
        <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          Sent to {prettyPhone(phone)}.{" "}
          <button onClick={() => setStep("phone")} className="underline underline-offset-2" style={{ color: "var(--chalk-70)" }}>
            Wrong number?
          </button>
        </p>
        <input
          ref={codeRef}
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          name="code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) verify(v);
          }}
          placeholder="••••••"
          className="mt-5 w-full rounded-[18px] border bg-transparent text-center outline-none"
          style={{ height: 64, background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)", fontSize: 30, letterSpacing: "0.35em" }}
        />
        {error && <Err>{error}</Err>}
        <button onClick={() => verify(code)} disabled={code.length !== 6 || busy} className="pressable btn-primary mt-4 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: code.length !== 6 || busy ? 0.55 : 1 }}>
          {busy ? "Checking…" : "Continue"}
        </button>
        <button
          onClick={() => {
            if (resendIn > 0 || busy) return;
            send(phone);
          }}
          disabled={resendIn > 0 || busy}
          className="pressable mt-3 flex h-10 w-full items-center justify-center text-[14px]"
          style={{ color: resendIn > 0 ? "var(--chalk-35)" : "var(--chalk-55)" }}
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend the code"}
        </button>
      </>
    );
  }

  if (shown === "about") {
    return (
      <>
        <p className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
          You&apos;re in, {name.trim()}.
        </p>
        <div className="mt-3">
          <AboutYou intro onDone={() => setStep("done")} />
        </div>
      </>
    );
  }

  if (shown === "profile") {
    const bdOk = bd.m.length >= 1 && bd.d.length >= 1 && bd.y.length === 4;
    return (
      <>
        <p className="eyebrow">Last thing</p>
        <h2 className="serif mt-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
          Who&apos;s this?
        </h2>
        <label className="mt-5 block">
          <span className="eyebrow">First name</span>
          <input
            autoFocus
            type="text"
            autoComplete="given-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tim"
            maxLength={40}
            className="mt-2 w-full rounded-[18px] border px-4 text-[20px] outline-none"
            style={{ height: 58, background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" }}
          />
        </label>
        <div className="mt-4">
          <span className="eyebrow">Birthday</span>
          <div className="mt-2 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
            <DateBox label="MM" value={bd.m} max={2} onChange={(v) => { setBd((b) => ({ ...b, m: v })); if (v.length === 2) dRef.current?.focus(); }} autoComplete="bday-month" />
            <DateBox ref={dRef} label="DD" value={bd.d} max={2} onChange={(v) => { setBd((b) => ({ ...b, d: v })); if (v.length === 2) yRef.current?.focus(); }} autoComplete="bday-day" />
            <DateBox ref={yRef} label="YYYY" value={bd.y} max={4} onChange={(v) => setBd((b) => ({ ...b, y: v }))} autoComplete="bday-year" onEnter={finish} />
          </div>
        </div>
        {error && <Err>{error}</Err>}
        <button onClick={finish} disabled={!name.trim() || !bdOk || busy} className="pressable btn-primary mt-5 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: !name.trim() || !bdOk || busy ? 0.55 : 1 }}>
          {busy ? "Saving…" : "Done"}
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--chalk-35)" }}>
          ROUND is for 21 and over. Your birthday is never shown to anyone.
        </p>
      </>
    );
  }

  return (
    <div className="py-2 text-center">
      <p className="eyebrow">You&apos;re in</p>
      <h2 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.05 }}>
        {shownName.trim() ? `Welcome, ${shownName.trim()}.` : "Welcome."}
      </h2>
      <p className="mt-2 text-[14px]" style={{ color: "var(--chalk-55)" }}>
        Everything you save is yours now, on any phone.
      </p>
    </div>
  );
}


const DateBox = forwardRef<HTMLInputElement, { label: string; value: string; max: number; onChange: (v: string) => void; autoComplete: string; onEnter?: () => void }>(
  function DateBox({ label, value, max, onChange, autoComplete, onEnter }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        placeholder={label}
        aria-label={label}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, max))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="w-full rounded-[18px] border text-center text-[20px] outline-none"
        style={{ height: 58, background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)", letterSpacing: "0.04em" }}
      />
    );
  },
);

function Err({ children }: { children: React.ReactNode }) {
  const [head, ...rest] = String(children).split("\n");
  const detail = rest.join(" ").trim();
  return (
    <div className="mt-3" role="alert">
      <p className="text-[13px]" style={{ color: "var(--tomato-deep)" }}>
        {head}
      </p>
      {detail && detail !== head && (
        <p className="mt-1 break-words text-[11px] leading-snug" style={{ color: "var(--chalk-35)" }}>
          {detail}
        </p>
      )}
    </div>
  );
}
