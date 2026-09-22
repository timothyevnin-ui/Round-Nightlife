"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Photo } from "@/components/Photo";
import { useRoundStore } from "@/lib/store";
import { venueMap } from "@/lib/venues";
import type { Venue } from "@/lib/types";
import { neighborhoodName } from "@/lib/neighborhoods";

type Reading = {
  index: number;
  name: string | null;
  neighborhood: string | null;
  creator: string | null;
  slug: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
};

export function AddView({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const byslug = venueMap(venues);
  const { state, toggleSaved } = useRoundStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs when the page unmounts.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => () => previewsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const pick = (list: FileList | null) => {
    if (!list) return;
    setReadings(null);
    setError(null);
    const next = Array.from(list).slice(0, 10);
    previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewsRef.current = next.map((f) => URL.createObjectURL(f));
    setFiles(next);
    setPreviews(previewsRef.current);
  };

  const read = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/screenshots", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "ROUND couldn't read those.");
        return;
      }
      setReadings(json.readings as Reading[]);
      // Remember unmatched places locally — the curation inbox.
      try {
        const inbox = JSON.parse(window.localStorage.getItem("round:inbox") ?? "[]") as unknown[];
        const fresh = (json.readings as Reading[]).filter((r) => r.name && !r.slug).map((r) => ({ name: r.name, neighborhood: r.neighborhood, creator: r.creator, at: new Date().toISOString() }));
        window.localStorage.setItem("round:inbox", JSON.stringify([...inbox, ...fresh]));
      } catch {
        /* ignore */
      }
    } catch {
      setError("Network hiccup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen mx-auto w-full max-w-md pb-16">
      <header className="flex items-center justify-between pt-4 pb-2">
        <button onClick={() => router.back()} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">Your map</span>
        <span className="w-11" />
      </header>

      <section className="pt-4">
        <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          Add from
          <br />
          screenshots.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: "var(--chalk-70)" }}>
          Every TikTok, Reel, or text that said &ldquo;you have to go here.&rdquo; Pick the screenshots; ROUND reads them and puts the places on your map.
        </p>
      </section>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => pick(e.target.files)}
      />

      {files.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="pressable card mt-8 flex w-full flex-col items-center justify-center gap-3 py-12"
          style={{ borderStyle: "dashed", borderColor: "var(--hairline-strong)" }}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--cobalt)" }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path d="M11 4v14M4 11h14" stroke="#F2F0EA" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[16px] font-medium">Choose screenshots</span>
          <span className="text-[12.5px]" style={{ color: "var(--chalk-55)" }}>
            Up to ten at a time
          </span>
        </button>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="aspect-[9/16] w-full rounded-[14px] object-cover" style={{ background: "var(--surface)" }} />
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              className="pressable flex aspect-[9/16] items-center justify-center rounded-[14px] border text-[13px]"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--chalk-55)" }}
            >
              Change
            </button>
          </div>
          {!readings && (
            <button onClick={read} disabled={busy} className="pressable btn-primary mt-5 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: busy ? 0.7 : 1 }}>
              {busy ? "Reading…" : `Read ${files.length === 1 ? "it" : `${files.length} screenshots`}`}
            </button>
          )}
        </>
      )}

      {error && (
        <div className="card mt-5 p-5">
          <p className="text-[14.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
            {error}
          </p>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--chalk-35)" }}>
            Screenshot reading runs on Claude. Add <code>ANTHROPIC_API_KEY</code> to the deployment and it works.
          </p>
        </div>
      )}

      {readings && (
        <section className="mt-6 flex flex-col gap-3">
          {readings.map((r, i) => {
            const venue = r.slug ? byslug[r.slug] : undefined;
            const saved = venue ? !!state.saved[venue.slug] : false;
            return (
              <motion.div key={r.index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex items-center gap-3 p-3">
                {venue ? (
                  <Link href={`/v/${venue.slug}`} className="shrink-0">
                    <Photo venue={venue} rounded="rounded-[12px]" className="h-14 w-14" />
                  </Link>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[r.index]} alt="" className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="serif truncate" style={{ fontSize: 20, lineHeight: 1.1 }}>
                    {venue?.name ?? r.name ?? "Couldn't tell"}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                    {venue
                      ? `${neighborhoodName(venue.neighborhood)}${r.creator ? ` · from ${r.creator}` : ""}`
                      : r.name
                        ? `Not on ROUND yet${r.creator ? ` · from ${r.creator}` : ""} · noted for curation`
                        : r.note ?? "No place found in this one"}
                  </p>
                </div>
                {venue && (
                  <button
                    onClick={() => toggleSaved(venue.slug, "screenshot")}
                    className="pressable flex h-10 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium"
                    style={saved ? { background: "var(--cobalt)", borderColor: "var(--cobalt)" } : { borderColor: "var(--hairline-strong)" }}
                  >
                    {saved ? "Saved" : "Save"}
                  </button>
                )}
              </motion.div>
            );
          })}
          <Link href="/you" className="pressable btn-ghost mt-2 flex h-12 items-center justify-center text-[14px]">
            See your map
          </Link>
        </section>
      )}

      <p className="mt-10 text-center text-[12px] leading-relaxed" style={{ color: "var(--chalk-35)" }}>
        Coming next: a ROUND shortcut in the share sheet,
        <br />
        so any screenshot or link lands here in one tap.
      </p>
    </main>
  );
}
