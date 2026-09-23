"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        placeholder="PIN"
        autoFocus
        className="h-14 w-full rounded-full border px-5 text-[18px] tracking-[0.3em] outline-none"
        style={{ background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" }}
      />
      {state?.error && (
        <p className="px-2 text-[13px]" style={{ color: "#ff8a8a" }}>
          {state.error}
        </p>
      )}
      <button disabled={pending} className="pressable btn-primary flex h-14 items-center justify-center text-[16px]" style={{ opacity: pending ? 0.7 : 1 }}>
        {pending ? "One sec…" : "Open"}
      </button>
    </form>
  );
}
