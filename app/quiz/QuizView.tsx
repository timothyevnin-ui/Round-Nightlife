"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Photo } from "@/components/Photo";
import { useRoundStore } from "@/lib/store";
import { QUIZ_SLUGS, venueMap } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

type Verdict = "pass" | "want" | "been" | "loved";

export function QuizView({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const { toggleSaved, markBeen, setQuizDone, state } = useRoundStore();
  const deck = useMemo(() => {
    const m = venueMap(venues);
    const picked = QUIZ_SLUGS.map((s) => m[s]).filter((v): v is Venue => !!v);
    // If the database has different places than the seed, fall back to the ten most "regular" bars.
    return picked.length >= 6 ? picked : venues.filter((v) => v.kind === "bar").sort((a, b) => (b.friendsBeen ?? 0) - (a.friendsBeen ?? 0)).slice(0, 10);
  }, [venues]);
  const [i, setI] = useState(0);
  const [log, setLog] = useState<Record<string, Verdict>>({});
  const [exitDir, setExitDir] = useState<1 | -1>(1);
  const done = i >= deck.length;
  const card = deck[i];

  const answer = (verdict: Verdict) => {
    if (!card) return;
    setExitDir(verdict === "pass" ? -1 : 1);
    setLog((l) => ({ ...l, [card.slug]: verdict }));
    if (verdict === "want" && !state.saved[card.slug]) toggleSaved(card.slug, "quiz");
    if (verdict === "been") markBeen(card.slug, { rating: "good" });
    if (verdict === "loved") markBeen(card.slug, { rating: "loved" });
    const next = i + 1;
    setI(next);
    if (next >= deck.length) setQuizDone(true);
  };

  const summary = useMemo(() => summarize(deck, log), [deck, log]);

  return (
    <main className="screen relative mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ minHeight: "100dvh" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(90% 50% at 50% -10%, rgba(43,77,255,0.45), transparent 70%)" }}
      />
      <header className="relative z-10 flex items-center justify-between pt-4 pb-2">
        <button onClick={() => router.back()} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">{done ? "Your taste" : `${i + 1} of ${deck.length}`}</span>
        <Link href="/you" className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      {!done ? (
        <>
          <div className="relative z-10 pt-3">
            <h1 className="serif" style={{ fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              Been here?
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--chalk-55)" }}>
              Swipe right to save it, left to pass, or tap what&apos;s true.
            </p>
          </div>

          <div className="relative z-10 mt-5 flex-1" style={{ minHeight: 380 }}>
            <AnimatePresence custom={exitDir}>
              {deck.slice(i, i + 2).reverse().map((v, idx, arr) => {
                const top = idx === arr.length - 1;
                return (
                  <SwipeCard key={v.slug} venue={v} top={top} onSwipe={(dir) => answer(dir === "right" ? "want" : "pass")} exitDir={exitDir} />
                );
              })}
            </AnimatePresence>
          </div>

          <div className="relative z-10 grid grid-cols-4 gap-2 pb-8 pt-4">
            <Verdict label="Pass" onClick={() => answer("pass")} icon={<Cross />} />
            <Verdict label="Want to go" onClick={() => answer("want")} icon={<Bookmark />} accent="cobalt" />
            <Verdict label="Been" onClick={() => answer("been")} icon={<Check />} />
            <Verdict label="Loved it" onClick={() => answer("loved")} icon={<Heart />} accent="chalk" />
          </div>
        </>
      ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex flex-1 flex-col pt-6">
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            {summary.headline}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.5]" style={{ color: "var(--chalk-70)" }}>
            {summary.body}
          </p>
          <div className="mt-8 flex flex-col gap-2.5">
            <Link href="/" className="pressable btn-primary flex h-14 items-center justify-center text-[16px]">
              Where should we go?
            </Link>
            <Link href="/you" className="pressable btn-ghost flex h-12 items-center justify-center text-[14px]">
              See your map
            </Link>
          </div>
        </motion.section>
      )}
    </main>
  );
}

function SwipeCard({ venue, top, onSwipe, exitDir }: { venue: Venue; top: boolean; onSwipe: (dir: "left" | "right") => void; exitDir: 1 | -1 }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const wantOpacity = useTransform(x, [40, 120], [0, 1]);
  const passOpacity = useTransform(x, [-40, -120], [0, 1]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 600) onSwipe("right");
    else if (info.offset.x < -110 || info.velocity.x < -600) onSwipe("left");
  };
  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate, zIndex: top ? 2 : 1 }}
      initial={{ scale: top ? 1 : 0.95, y: top ? 0 : 14, opacity: top ? 1 : 0.7 }}
      animate={{ scale: top ? 1 : 0.95, y: top ? 0 : 14, opacity: top ? 1 : 0.7 }}
      exit={{ x: 380 * exitDir, opacity: 0, rotate: 12 * exitDir, transition: { duration: 0.28 } }}
      drag={top ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
    >
      <Photo venue={venue} rounded="rounded-[28px]" className="h-full w-full">
        <motion.span
          style={{ opacity: wantOpacity }}
          className="absolute left-5 top-5 rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-[0.12em]"
        >
          <span className="rounded-full px-3 py-1.5" style={{ background: "var(--cobalt)", color: "var(--chalk)" }}>WANT TO GO</span>
        </motion.span>
        <motion.span style={{ opacity: passOpacity }} className="absolute right-5 top-5 text-[12px] font-semibold tracking-[0.12em]">
          <span className="rounded-full px-3 py-1.5" style={{ background: "rgba(11,12,16,0.7)", color: "var(--chalk)" }}>PASS</span>
        </motion.span>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="eyebrow" style={{ color: "rgba(242,240,234,0.7)" }}>
            {neighborhoodName(venue.neighborhood)}
          </p>
          <h2 className="serif mt-1" style={{ fontSize: 36, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            {venue.name}
          </h2>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: "rgba(242,240,234,0.8)" }}>
            {venue.take}
          </p>
        </div>
      </Photo>
    </motion.div>
  );
}

function Verdict({ label, onClick, icon, accent }: { label: string; onClick: () => void; icon: React.ReactNode; accent?: "cobalt" | "chalk" }) {
  const style =
    accent === "cobalt"
      ? { background: "var(--cobalt)", color: "var(--chalk)", borderColor: "var(--cobalt)" }
      : accent === "chalk"
        ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" }
        : { background: "rgba(242,240,234,0.06)", color: "var(--chalk)", borderColor: "var(--hairline)" };
  return (
    <button onClick={onClick} className="pressable flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border" style={style}>
        {icon}
      </span>
      <span className="text-[11px] font-medium" style={{ color: "var(--chalk-55)" }}>
        {label}
      </span>
    </button>
  );
}

function summarize(deck: Venue[], log: Record<string, Verdict>) {
  const liked = deck.filter((v) => log[v.slug] === "loved" || log[v.slug] === "want" || log[v.slug] === "been");
  const loved = deck.filter((v) => log[v.slug] === "loved");
  const pool = loved.length >= 2 ? loved : liked;
  if (pool.length === 0) return { headline: "Picky. Respect.", body: "ROUND will start from the editorial picks and learn from where you actually go." };
  const sums = { lively: 0, chill: 0, talk: 0 };
  for (const v of pool) {
    sums.lively += v.attrs.lively;
    sums.chill += v.attrs.chill;
    sums.talk += v.attrs.talk;
  }
  const vibe = Object.entries(sums).sort((a, b) => b[1] - a[1])[0][0] as "lively" | "chill" | "talk";
  const hoods = [...new Set(pool.map((v) => neighborhoodName(v.neighborhood)))].slice(0, 2);
  const headline = { lively: "You like a room with a pulse.", chill: "You like to sit down and stay.", talk: "You like to hear people." }[vibe];
  const body = `${loved.length ? `${loved.length} loved, ` : ""}${liked.length} on your map${hoods.length ? `, mostly ${hoods.join(" and ")}` : ""}. ROUND weights ${
    { lively: "lively rooms", chill: "slower nights", talk: "places you can talk" }[vibe]
  } a little higher for you from now on.`;
  return { headline, body };
}

const Cross = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
const Bookmark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M4.5 3.5h9v11.5L9 11.75 4.5 15V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const Check = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M3.5 9.5 7.25 13 14.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Heart = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M9 15s-5.5-3.4-5.5-7.2A3 3 0 0 1 9 6a3 3 0 0 1 5.5 1.8C14.5 11.6 9 15 9 15Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
