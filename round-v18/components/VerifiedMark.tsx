/**
 * ROUND's mark with a check: someone from ROUND has been. Shown next to a
 * place's name wherever it's named, only when the place is verified in Studio.
 * Our opinion is only worth something with the check on it.
 */
export function VerifiedMark({ size = 18, label = "Verified by ROUND", className = "" }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center align-middle ${className}`} role="img" aria-label={label} title={label} data-verified>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="var(--tomato)" strokeWidth="2.6" />
        <circle cx="12" cy="12" r="7.6" fill="var(--tomato)" />
        <path d="M8.2 12.3l2.5 2.5 5-5.2" stroke="var(--paper)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The longer form for the venue page. Two ways a place earns the mark:
 * someone from ROUND has been (bars, mostly), or ROUND's desk researched it
 * from several sources and checked it (restaurants); the line says which.
 */
export function VerifiedLine({ verified, desk = false }: { verified: boolean; desk?: boolean }) {
  return verified ? (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[12.5px] font-medium" style={{ background: "rgba(217,72,43,0.1)", color: "var(--tomato-deep, var(--tomato))" }} data-verified-line={desk ? "desk" : "been"}>
      <VerifiedMark size={18} />
      {desk ? "Checked by ROUND." : "Verified. ROUND has been."}
    </p>
  ) : (
    <p className="mt-3 text-[12.5px]" style={{ color: "var(--chalk-35)" }} data-unverified-line>
      Not yet verified by ROUND.
    </p>
  );
}
