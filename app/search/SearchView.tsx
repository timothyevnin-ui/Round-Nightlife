"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Photo } from "@/components/Photo";
import { VerifiedMark } from "@/components/VerifiedMark";
import { ScoreChip } from "@/components/Score";
import { matchVenues, normalizeName } from "@/lib/match";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { SearchEntry } from "@/lib/searchIndex";
import { track } from "@/lib/track";
import { BOUNTY_AMOUNT, money } from "@/lib/bounty";

/**
 * Search a bar. Names first (typos, missing apostrophes and dropped "The"s
 * are fine), then places whose tags or neighborhood match the words. Every
 * row opens ROUND's take on it.
 */
export function SearchView({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // "Been somewhere? Rate it." (V34): the same search, and a row opens the place with the rating sheet up.
  const rating = params.get("rate") === "1";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logged = useRef<string>("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => searchIndex(q, index), [q, index]);

  // Log a search once it settles (not per keystroke), and whether it found anything.
  useEffect(() => {
    const clean = q.trim();
    if (clean.length < 2) return;
    const id = window.setTimeout(() => {
      if (logged.current === clean.toLowerCase()) return;
      logged.current = clean.toLowerCase();
      track("search", { q: clean, data: { hits: results.length, top: results[0]?.slug ?? null } });
    }, 900);
    return () => window.clearTimeout(id);
  }, [q, results]);

  const open = (e: SearchEntry) => {
    track("search", { q: q.trim(), slug: e.slug, data: { picked: true, rate: rating } });
    router.push(rating ? `/v/${e.slug}?rate=1` : `/v/${e.slug}`);
  };

  const suggestions = useMemo(() => {
    const hot = index.filter((v) => v.hot);
    const pool = hot.length >= 4 ? hot : index;
    return pool.slice(0, 6);
  }, [index]);

  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col" style={{ minHeight: "100dvh" }}>
      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        <Link href="/" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="eyebrow">{rating ? "Rate a bar" : "Search"}</span>
        <span className="w-11" />
      </header>
      {rating && (
        <h1 className="serif mt-3" style={{ fontSize: 30, lineHeight: 1.04, letterSpacing: "-0.02em" }} data-rate-heading>
          Been somewhere? Find it.
        </h1>
      )}

      <div className="relative mt-3">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          <circle cx="7" cy="7" r="4.5" stroke="var(--ink-55)" strokeWidth="1.6" />
          <path d="M10.5 10.5 14 14" stroke="var(--ink-55)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) open(results[0]);
          }}
          placeholder={rating ? "The bar you went to" : "A bar you've heard about"}
          autoCapitalize="words"
          className="w-full rounded-[18px] border pl-11 pr-11 text-[17px] outline-none"
          style={{ height: 58, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
        />
        {q && (
          <button onClick={() => setQ("")} className="pressable absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "var(--ink-6)" }} aria-label="Clear">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2 2 10" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {q.trim().length < 2 ? (
        <section className="mt-8">
          <p className="eyebrow">{suggestions.some((v) => v.hot) ? "On the shelf right now" : "A few to start"}</p>
          <ul className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {suggestions.map((e) => (
              <Row key={e.slug} e={e} onOpen={open} />
            ))}
          </ul>
          <p className="mt-8 text-[13px] leading-relaxed" style={{ color: "var(--ink-35)" }}>
            {index.length} places so far. Type a name, a neighborhood, or a word like &ldquo;rooftop&rdquo; or &ldquo;dive&rdquo;.
          </p>
        </section>
      ) : results.length ? (
        <motion.ul key={results.map((r) => r.slug).join()} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="mt-4 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {results.map((e) => (
            <Row key={e.slug} e={e} onOpen={open} />
          ))}
        </motion.ul>
      ) : (
        <section className="mt-10 text-center" data-search-none>
          <h2 className="serif" style={{ fontSize: 30, lineHeight: 1.05 }}>
            Not on ROUND yet.
          </h2>
          <p className="mx-auto mt-3 max-w-[30ch] text-[14.5px]" style={{ color: "var(--ink-55)" }}>
            ROUND is built by the people who go. Add it, we check it, and {money(BOUNTY_AMOUNT)} lands in your Venmo if it makes the list.
          </p>
          <Link href={`/recommend?name=${encodeURIComponent(q.trim())}`} className="pressable btn-accent mx-auto mt-6 flex h-12 w-fit items-center px-6 text-[15px]" data-search-add>
            Add it, {money(BOUNTY_AMOUNT)}
          </Link>
        </section>
      )}
    </main>
  );
}

function Row({ e, onOpen }: { e: SearchEntry; onOpen: (e: SearchEntry) => void }) {
  return (
    <li>
      <button onClick={() => onOpen(e)} className="pressable flex w-full items-center gap-3 py-3 text-left">
        <Photo venue={e} rounded="rounded-[14px]" className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="serif truncate" style={{ fontSize: 20, lineHeight: 1.1 }}>
            {e.name}
            {e.verified && <VerifiedMark size={15} className="ml-1.5" />}
            {typeof e.score === "number" && (
              <span className="ml-2 align-middle">
                <ScoreChip score={e.score} />
              </span>
            )}
          </p>
          <p className="truncate text-[12.5px]" style={{ color: "var(--ink-55)" }}>
            {neighborhoodName(e.neighborhood)} · {e.kind === "restaurant" ? "Restaurant" : "Bar"} · {"$".repeat(e.price)}
            {e.tags.length ? ` · ${e.tags.join(" · ")}` : ""}
          </p>
          <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--ink-70)" }}>
            {e.line}
          </p>
        </div>
        <span className="serif shrink-0 text-[20px]" style={{ color: "var(--tomato)" }} aria-hidden>
          →
        </span>
      </button>
    </li>
  );
}

const HOOD_WORDS: { id: SearchEntry["neighborhood"]; words: string[] }[] = NEIGHBORHOODS.map((n) => ({ id: n.id, words: [normalizeName(n.name), normalizeName(n.short), n.id.replace(/-/g, " ")] }));

/** Name matches first, then tag / neighborhood / kind matches for the leftover words. */
export function searchIndex(query: string, index: SearchEntry[], limit = 12): SearchEntry[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const byName = matchVenues(q, index, limit).map((m) => m.venue);
  if (byName.length >= 5) return byName;
  const seen = new Set(byName.map((v) => v.slug));
  const words = q.split(" ").filter((w) => w.length >= 3);
  const hood = HOOD_WORDS.find((h) => h.words.some((w) => w && q.includes(w)))?.id;
  const rest = words.filter((w) => !hood || !HOOD_WORDS.find((h) => h.id === hood)!.words.some((hw) => hw.includes(w)));
  const scored = index
    .filter((v) => !seen.has(v.slug))
    .map((v) => {
      let score = 0;
      if (hood && v.neighborhood === hood) score += 1;
      const hay = normalizeName([v.name, v.kind, ...v.tags, v.line].join(" "));
      for (const w of rest) if (hay.includes(w)) score += w === "bar" || w === "restaurant" ? 0.3 : 1;
      if (rest.length && !rest.some((w) => hay.includes(w))) score = hood ? score * 0.3 : 0;
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.v.hot ? 1 : 0) - (a.v.hot ? 1 : 0))
    .slice(0, limit - byName.length)
    .map((x) => x.v);
  return [...byName, ...rest.length || hood ? scored : []];
}
