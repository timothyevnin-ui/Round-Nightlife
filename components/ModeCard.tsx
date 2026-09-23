"use client";

import Link from "next/link";
import { motion } from "motion/react";

/** A door on the home page. Deep color, cream type, one line of promise. */
export function ModeCard({
  href,
  label,
  sub,
  gradient,
  delay = 0,
  size = "tall",
  eyebrow,
}: {
  href: string;
  label: string;
  sub?: string;
  gradient: string;
  delay?: number;
  size?: "tall" | "wide" | "slim";
  eyebrow?: string;
}) {
  const tall = size === "tall";
  const slim = size === "slim";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay }}
      className={tall ? "flex min-h-0 flex-1" : "flex"}
    >
      <Link
        href={href}
        className={`pressable grain relative flex w-full flex-col justify-end overflow-hidden rounded-[26px] ${tall ? "min-h-[152px] p-4" : slim ? "min-h-[60px] px-4 py-2.5" : "min-h-[88px] px-4 py-3.5"}`}
        style={{ background: gradient, color: "var(--on-photo)", boxShadow: "0 14px 34px -22px rgba(22,33,58,0.55)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(90% 70% at 85% 8%, rgba(255,255,255,0.2), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.3) 100%)",
          }}
        />
        <div className={`relative flex ${tall ? "flex-col items-start gap-2" : "items-end justify-between gap-4"}`}>
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--on-photo-60)" }}>
                {eyebrow}
              </p>
            )}
            <div className="serif" style={{ fontSize: tall ? 30 : slim ? 22 : 28, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {label}
            </div>
            {sub && (
              <p className={`mt-1.5 text-[12.5px] leading-snug ${tall ? "max-w-[26ch]" : "max-w-[44ch]"}`} style={{ color: "var(--on-photo-80)" }}>
                {sub}
              </p>
            )}
          </div>
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(246,241,231,0.16)", backdropFilter: "blur(8px)" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="#F6F1E7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
