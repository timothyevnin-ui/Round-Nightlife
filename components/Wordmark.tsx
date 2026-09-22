import Link from "next/link";

export function Wordmark({ size = 22, href = "/" }: { size?: number; href?: string | null }) {
  const inner = (
    <span className="inline-flex items-center gap-2.5">
      <span className="ring-mark" aria-hidden />
      <span
        className="serif"
        style={{ fontSize: size, letterSpacing: "0.18em", lineHeight: 1, paddingLeft: "0.06em" }}
      >
        ROUND
      </span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="ROUND home" className="pressable inline-flex">
      {inner}
    </Link>
  );
}
