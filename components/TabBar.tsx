"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddSheet } from "./AddSheet";

const LEFT = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/best", label: "Ranked", icon: RankIcon },
] as const;
const RIGHT = [
  { href: "/map", label: "Map", icon: SpotsIcon },
  { href: "/you", label: "You", icon: YouIcon },
] as const;

/** How far the + floats above the bar's top edge (its cradle ring included). */
const TAB_FLOAT = 32;

/**
 * Home · Ranked · (+) · Map · You (V34). The + floats out of the bar in its
 * own cradle, the one tomato thing on every screen: rate a bar you've been
 * to, or add one we don't have. Pages pad for it (see .screen-with-tabs),
 * so it never sits on top of anything.
 */
export function TabBar() {
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/you" ? pathname.startsWith("/you") || pathname.startsWith("/friends") : href === "/best" ? pathname.startsWith("/best") : pathname.startsWith("/map") || pathname.startsWith("/spots");
  return (
    <>
      <nav className="tabbar-ground fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Primary" data-tabbar>
        <div className="relative mx-auto max-w-md" style={{ paddingTop: 6 }}>
          <button
            onClick={() => setAdding(true)}
            className="pressable absolute left-1/2 flex h-[62px] w-[62px] -translate-x-1/2 items-center justify-center rounded-full"
            style={{ top: -(TAB_FLOAT - 6), background: "var(--tomato)", color: "var(--on-photo)", boxShadow: "0 0 0 6px var(--night-2), 0 16px 34px -10px rgba(217,72,43,0.85), 0 2px 6px rgba(0,0,0,0.35)" }}
            aria-label="Rate a bar, or add one"
            data-tab-add
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-stretch px-2" style={{ height: "var(--tab-height)" }}>
            {LEFT.map((t) => (
              <Tab key={t.href} t={t} active={isActive(t.href)} />
            ))}
            <div className="w-[76px] shrink-0" aria-hidden />
            {RIGHT.map((t) => (
              <Tab key={t.href} t={t} active={isActive(t.href)} />
            ))}
          </div>
        </div>
      </nav>
      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function Tab({ t, active }: { t: (typeof LEFT)[number] | (typeof RIGHT)[number]; active: boolean }) {
  const Icon = t.icon;
  return (
    <Link href={t.href} className="pressable tabbar-item flex min-w-[60px] flex-1 flex-col items-center justify-center gap-1" aria-current={active ? "page" : undefined}>
      <Icon active={active} />
      <span className="text-[11px] font-medium tracking-wide">{t.label}</span>
    </Link>
  );
}

function RankIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V11M10 19V5M16 19v-9M22 19H2" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" />
      {active && <circle cx="10" cy="5" r="2.2" fill="var(--tomato)" />}
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
      {active && <circle cx="12" cy="12" r="3" fill="var(--tomato)" />}
    </svg>
  );
}

function SpotsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" fill={active ? "var(--tomato)" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} />
    </svg>
  );
}

function YouIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
      <path d="M4.5 20c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" />
    </svg>
  );
}
