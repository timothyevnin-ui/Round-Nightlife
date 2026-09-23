"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { matchVenues } from "@/lib/match";
import { neighborhoodName } from "@/lib/neighborhoods";
import { nowWhen } from "@/lib/when";
import { track } from "@/lib/track";
import type { NeighborhoodId } from "@/lib/types";

export type NearPlace = { slug: string; name: string; neighborhood: NeighborhoodId; lat: number; lng: number };

/**
 * Near me. The phone's location, the bar you're standing in, or an address;
 * all end up on the results carousel with bars sorted by the walk. Typing
 * the name of a place ROUND knows uses its pin directly, no geocoder.
 */
export function NearView({ places }: { places: NearPlace[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"gps" | "address" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const matches = useMemo(() => (address.trim().length >= 2 ? matchVenues(address, places, 4).map((m) => m.venue) : []), [address, places]);

  const go = (lat: number, lng: number, label?: string) => {
    const { dow, hour } = nowWhen();
    const p = new URLSearchParams({ m: "near", lat: lat.toFixed(5), lng: lng.toFixed(5), t: String(hour), d: String(dow) });
    if (label) p.set("at", label);
    router.push(`/results?${p.toString()}`);
  };

  const useLocation = () => {
    setError(null);
    if (!("geolocation" in navigator)) return setError("This browser can't share your location. Type an address instead.");
    setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      (pos) => go(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? "Location is off for ROUND. Allow it in Settings, or type an address." : "Couldn't get a fix. Try an address.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const goToPlace = (p: NearPlace) => {
    track("near", { q: address.trim(), slug: p.slug, data: { via: "place" } });
    go(p.lat, p.lng, p.name);
  };

  const lookup = async () => {
    if (!address.trim() || busy) return;
    // A place we know wins over the geocoder ("I'm at Bar Primi").
    const exact = matches[0];
    if (exact) return goToPlace(exact);
    setBusy("address");
    setError(null);
    try {
      track("near", { q: address.trim(), data: { via: "address" } });
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address.trim())}`);
      const json = (await res.json()) as { lat?: number; lng?: number; label?: string; error?: string };
      if (!res.ok || json.lat === undefined || json.lng === undefined) throw new Error(json.error ?? "Couldn't find that.");
      go(json.lat, json.lng, json.label);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Couldn't find that.");
    }
  };

  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col" style={{ minHeight: "100dvh" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 55% at 50% -10%, rgba(217,72,43,0.18), transparent 70%)" }} />
      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        <Link href="/" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="eyebrow">Near me</span>
        <span className="w-11" />
      </header>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex flex-1 flex-col pt-6">
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          Bars you can
          <br />
          walk to.
        </h1>
        <p className="mt-3 text-[15px]" style={{ color: "var(--ink-55)" }}>
          Where you are, or where you&apos;re headed. Sorted by the walk.
        </p>

        <button onClick={useLocation} disabled={!!busy} className="pressable btn-accent mt-8 flex h-16 w-full items-center justify-center gap-3 text-[17px]" style={{ opacity: busy ? 0.7 : 1 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="10" cy="10" r="1.4" fill="currentColor" />
          </svg>
          {busy === "gps" ? "Finding you…" : "Use my location"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
          <span className="text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--ink-35)" }}>
            or
          </span>
          <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
        </div>

        <label className="block">
          <span className="eyebrow">The bar you&apos;re at, or an address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Bar Primi, or 151 Bleecker St"
            className="mt-2 w-full rounded-[18px] border px-4 text-[17px] outline-none"
            style={{ height: 58, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
          />
        </label>
        {matches.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }} aria-label="Places that match">
            {matches.map((p) => (
              <li key={p.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--hairline)" }}>
                <button onClick={() => goToPlace(p)} className="pressable flex w-full items-center justify-between px-4 py-3 text-left">
                  <span>
                    <span className="serif text-[18px]">{p.name}</span>
                    <span className="ml-2 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                      {neighborhoodName(p.neighborhood)}
                    </span>
                  </span>
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
                    I&apos;m here
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button onClick={lookup} disabled={!address.trim() || !!busy} className="pressable btn-primary mt-3 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: !address.trim() || busy ? 0.55 : 1 }}>
          {busy === "address" ? "Looking…" : matches[0] ? `Bars near ${matches[0].name}` : "Show bars near there"}
        </button>

        {error && (
          <p className="mt-4 text-[13.5px]" style={{ color: "var(--tomato-deep)" }} role="alert">
            {error}
          </p>
        )}

        <p className="mt-auto pt-8 text-[12px] leading-relaxed" style={{ color: "var(--ink-35)" }}>
          Your location never leaves your phone except to pick the bars; ROUND doesn&apos;t store it.
        </p>
      </motion.section>
    </main>
  );
}
