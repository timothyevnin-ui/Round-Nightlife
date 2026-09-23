/**
 * ROUND's score: how much we like a place, 0–100, in the ring. Think
 * Tomatometer, except the critic is us and there's only one of us. Shown
 * only once a score is set in Studio. The crowd's number sits beside it once
 * enough people have rated.
 */
export function ScoreBadge({ score, size = 44, className = "" }: { score?: number; size?: number; className?: string }) {
  if (typeof score !== "number") return null;
  const tone = score >= 85 ? "var(--tomato)" : score >= 70 ? "var(--pine)" : "var(--ink-55)";
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`} role="img" aria-label={`ROUND score ${score} out of 100`} title={`ROUND score ${score}`} data-score={score}>
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="absolute inset-0">
          <circle cx="50" cy="50" r={r} stroke="rgba(22,33,58,0.12)" strokeWidth="9" fill="none" />
          <circle cx="50" cy="50" r={r} stroke={tone} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
        </svg>
        <span className="serif relative" style={{ fontSize: size * 0.42, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>
          {score}
        </span>
      </span>
    </span>
  );
}

/** "ROUND 92" inline, for tight spots (search rows, shelf entries). */
export function ScoreChip({ score }: { score?: number }) {
  if (typeof score !== "number") return null;
  const tone = score >= 85 ? "var(--tomato)" : score >= 70 ? "var(--pine)" : "var(--ink-55)";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide" style={{ borderColor: tone, color: tone }} title={`ROUND score ${score}`} data-score={score}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: tone }} aria-hidden />
      {score}
    </span>
  );
}

export type Crowd = { n: number; back: number; again: number };

/** "88% would go back · 24 ratings". Nothing until three people have rated. */
export function CrowdLine({ crowd, className = "" }: { crowd?: Crowd | null; className?: string }) {
  if (!crowd || crowd.n < 3) return null;
  const pct = Math.round((crowd.back / crowd.n) * 100);
  return (
    <p className={`text-[12.5px] ${className}`} style={{ color: "var(--ink-55)" }} data-crowd>
      <span className="font-semibold" style={{ color: "var(--ink)" }}>
        {pct}%
      </span>{" "}
      would go back · {crowd.n} {crowd.n === 1 ? "rating" : "ratings"}
    </p>
  );
}
