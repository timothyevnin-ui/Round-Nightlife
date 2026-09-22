"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="pressable flex h-11 w-11 items-center justify-center rounded-full"
      style={{ background: "rgba(11,12,16,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(242,240,234,0.14)" }}
      aria-label="Back"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M13.5 5 8 11l5.5 6" stroke="#F2F0EA" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
