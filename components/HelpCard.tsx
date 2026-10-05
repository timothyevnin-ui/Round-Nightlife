"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BOUNTY_AMOUNT, money } from "@/lib/bounty";

/**
 * The ask, on the home page (V34): ROUND is new and it needs the city's
 * spots. Two things to do, in the voice of the TikTok slide.
 */
export function HelpCard() {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ type: "spring", stiffness: 240, damping: 28 }} className="theme-paper mt-9 overflow-hidden rounded-[26px]" style={{ background: "var(--surface)", color: "var(--ink)", boxShadow: "0 24px 50px -28px rgba(0,0,0,0.7)" }} data-help-card>
      <div className="p-5">
        <p className="eyebrow" style={{ color: "var(--tomato)" }}>
          We need your help
        </p>
        <h2 className="serif mt-1.5" style={{ fontSize: 30, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          ROUND is new.
          <br />
          It needs your spots.
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
          Your neighborhood bar. The place nobody posts about. Every rating makes the picker smarter; every new bar we approve is {money(BOUNTY_AMOUNT)} to your Venmo.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link href="/recommend" className="pressable flex items-center justify-between rounded-full px-5 text-[15px] font-semibold" style={{ height: 50, background: "var(--tomato)", color: "var(--on-photo)" }} data-help-add>
            <span>Add a bar we don&apos;t have</span>
            <span className="serif" style={{ fontSize: 20 }}>
              {money(BOUNTY_AMOUNT)}
            </span>
          </Link>
          <Link href="/search?rate=1" className="pressable flex items-center justify-between rounded-full border px-5 text-[15px] font-semibold" style={{ height: 50, borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-help-rate>
            <span>Rate one you&apos;ve been to</span>
            <span aria-hidden style={{ color: "var(--ink-35)" }}>
              →
            </span>
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
