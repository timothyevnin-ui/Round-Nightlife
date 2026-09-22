"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function ModeCard({
  href,
  label,
  sub,
  gradient,
  delay = 0,
}: {
  href: string;
  label: string;
  sub: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay }}
      className="flex min-h-0 flex-1"
    >
      <Link
        href={href}
        className="pressable grain relative flex min-h-[132px] w-full flex-1 flex-col justify-end overflow-hidden rounded-[28px] p-5"
        style={{ background: gradient }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 70% at 85% 10%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 100%)",
          }}
        />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <div className="serif" style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {label}
            </div>
            <p className="mt-1.5 max-w-[26ch] text-[13px] leading-snug" style={{ color: "rgba(242,240,234,0.78)" }}>
              {sub}
            </p>
          </div>
          <span
            aria-hidden
            className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(242,240,234,0.14)", backdropFilter: "blur(8px)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="#F2F0EA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
