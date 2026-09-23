"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="pressable flex h-11 w-11 items-center justify-center rounded-full"
      style={{ background: "rgba(22,33,58,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(246,241,231,0.22)" }}
      aria-label="Back"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M13.5 5 8 11l5.5 6" stroke="#F6F1E7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
