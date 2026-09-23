"use client";

import { useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { logout } from "./actions";

/**
 * ROUND Studio: the private side. A sidebar on a laptop, a strip of tabs on a
 * phone. Every page under /admin sits inside it except the door.
 */

const NAV: { href: string; label: string; hint: string; wide?: boolean }[] = [
  { href: "/admin", label: "Dashboard", hint: "What's happening", wide: true },
  { href: "/admin/places", label: "Places", hint: "Every bar and restaurant", wide: true },
  { href: "/admin/stories", label: "Stories", hint: "The blog and the shelf" },
  { href: "/admin/suggestions", label: "Recommendations", hint: "What people sent in" },
  { href: "/admin/people", label: "People", hint: "Accounts", wide: true },
  { href: "/admin/activity", label: "Activity", hint: "Everything, in order", wide: true },
];

function activeFor(pathname: string) {
  if (pathname === "/admin") return "/admin";
  const hit = NAV.filter((n) => n.href !== "/admin" && pathname.startsWith(n.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.href ?? (pathname.startsWith("/admin/v/") || pathname.startsWith("/admin/new") || pathname.startsWith("/admin/add") ? "/admin/places" : "");
}

function rememberStudio() {
  try {
    window.localStorage.setItem("round:studio", "1");
  } catch {
    /* ignore */
  }
}

export function StudioShell({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  useEffect(() => {
    if (signedIn) rememberStudio();
  }, [signedIn]);
  if (!signedIn || pathname.startsWith("/admin/login")) return <div className="mx-auto w-full max-w-md">{children}</div>;
  const active = activeFor(pathname);
  const wide = NAV.find((n) => n.href === active)?.wide && !pathname.startsWith("/admin/v/") && !pathname.startsWith("/admin/new") && !pathname.startsWith("/admin/add");

  return (
    <div className="studio">
      <aside className="studio-side">
        <div className="flex items-center justify-between px-5 pt-6 lg:block lg:pt-7">
          <div className="flex items-center gap-2">
            <Wordmark />
            <Link href="/admin" className="eyebrow" style={{ color: "var(--tomato)" }}>
              Studio
            </Link>
          </div>
          <form action={logout} className="lg:hidden">
            <button className="pressable text-[12px]" style={{ color: "var(--ink-35)" }}>
              Sign out
            </button>
          </form>
        </div>
        <nav className="studio-nav no-scrollbar" aria-label="Studio">
          {NAV.map((n) => {
            const on = n.href === active;
            return (
              <Link key={n.href} href={n.href} className="studio-link pressable" data-on={on ? "1" : "0"}>
                <span className="block text-[14px] font-medium">{n.label}</span>
                <span className="hidden text-[11.5px] lg:block" style={{ color: on ? "var(--on-photo-80)" : "var(--ink-35)" }}>
                  {n.hint}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 pb-6 lg:mt-auto lg:block">
          <Link href="/admin/add" className="pressable btn-primary flex h-11 w-full items-center justify-center text-[14px]">
            + Add a place
          </Link>
          <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: "var(--ink-35)" }}>
            <Link href="/" className="pressable underline">
              Open the app
            </Link>
            <form action={logout}>
              <button className="pressable">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className={`studio-main ${wide ? "studio-wide" : ""}`}>{children}</div>
    </div>
  );
}
