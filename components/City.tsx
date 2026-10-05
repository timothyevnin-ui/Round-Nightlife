import Link from "next/link";
import { PeopleSay } from "./PeopleSay";
import type { CrowdLineRow, Venue, VenueCrowd } from "@/lib/types";

/**
 * What New York says, on a place's page (V32), under Heads up and above the
 * address: what people say it's best for, the badges, the numbers line, and
 * People say, one line each with a first name. Nothing here is ROUND's;
 * ROUND SAYS stays up top, untouched.
 */

const SHOW_PCT_FROM = 3;

export function City({ venue, lines }: { venue: Pick<Venue, "slug" | "name" | "kind" | "crowd">; lines: CrowdLineRow[] }) {
  const c: VenueCrowd | undefined = venue.crowd;
  const n = c?.n ?? 0;
  const best = (c?.bestFor ?? []).filter((b) => b.n >= 1).slice(0, 5);
  const back = n ? Math.round((100 * (c?.back ?? 0)) / n) : 0;
  return (
    <section className="mt-7 border-t pt-6" style={{ borderColor: "var(--hairline)" }} data-city data-city-n={n}>
      <p className="eyebrow" style={{ color: "var(--pine)" }}>
        New York says
      </p>
      {n === 0 && !lines.length ? (
        <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--ink-55)" }} data-city-empty>
          Nobody&apos;s rated {venue.name} yet.{" "}
          <Link href="#rate" className="font-medium" style={{ color: "var(--tomato)" }}>
            Been? Be the first.
          </Link>
        </p>
      ) : (
        <>
          {best.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2" data-best-for>
              {best.map((b, i) => {
                const strong = (c?.bestN ?? 0) >= SHOW_PCT_FROM && (i === 0 || b.pct >= 50);
                return (
                  <span key={b.key} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium" style={strong ? { background: "var(--pine)", color: "var(--paper)", borderColor: "var(--pine)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }} data-best={b.key}>
                    {b.label}
                    {strong && <span style={{ opacity: 0.7 }}>{b.pct}%</span>}
                  </span>
                );
              })}
              {(c?.badges ?? []).map((b) => (
                <span key={b} className="inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }} data-badge={b}>
                  {b}
                </span>
              ))}
            </div>
          )}
          {n > 0 && (
            <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--ink-55)" }} data-city-line>
              {n >= 3 && (
                <>
                  <b style={{ color: "var(--ink)" }}>{back}%</b> would go back ·{" "}
                </>
              )}
              {n} {n === 1 ? "rating" : "ratings"}
              {c?.round && (
                <>
                  {" "}
                  · a round for four is <b style={{ color: "var(--ink)" }}>{c.round}</b>
                </>
              )}
            </p>
          )}
          <PeopleSay lines={lines} slug={venue.slug} />
          <p className="mt-3 text-[13px] font-medium">
            <Link href="#rate" style={{ color: "var(--tomato)" }} data-city-rate>
              Been? Rate it and add yours →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
