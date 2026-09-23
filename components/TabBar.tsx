"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/friends", label: "Friends", icon: FriendsIcon },
  { href: "/you", label: "You", icon: YouIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
    >
      <div className="tabbar-ground mx-auto max-w-md" style={{ paddingTop: 18 }}>
        <div className="flex items-stretch justify-around px-6" style={{ height: "var(--tab-height)" }}>
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="pressable tabbar-item flex flex-col items-center justify-center gap-1 min-w-[72px]"
                aria-current={active ? "page" : undefined}
              >
                <Icon active={active} />
                <span className="text-[11px] font-medium tracking-wide">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
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

function FriendsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="6.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
      <circle cx="15.5" cy="12" r="6.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
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
