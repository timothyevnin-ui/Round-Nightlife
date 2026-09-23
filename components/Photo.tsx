import type { CSSProperties, ReactNode } from "react";
import type { Venue } from "@/lib/types";

/**
 * Placeholder photography. Until ROUND has its own shots, each venue renders
 * as a two-tone gradient with film grain and a soft light source — enough to
 * judge the layout and the feel, never mistaken for the real thing.
 */
export function Photo({
  venue,
  className = "",
  style,
  children,
  rounded = "rounded-[24px]",
  credit = false,
}: {
  venue: Pick<Venue, "photo" | "name" | "photoUrl"> & { photoCredit?: string };
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  rounded?: string;
  /** Show the photo credit in the corner (big photos only; small tiles link to a page that credits). */
  credit?: boolean;
}) {
  const { from, to, angle = 160 } = venue.photo;
  return (
    <div
      className={`grain relative overflow-hidden ${rounded} ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(${angle}deg, ${from}, ${to})`,
        color: "var(--on-photo)",
        ...style,
      }}
      aria-label={venue.photoUrl ? venue.name : `${venue.name} — photo coming`}
    >
      {venue.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 45% at 75% 85%, rgba(255,220,160,0.14), transparent 70%), linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      {children}
      {credit && venue.photoUrl && venue.photoCredit && (
        <span className="pointer-events-none absolute bottom-1.5 right-2 max-w-[70%] truncate text-[9.5px]" style={{ color: "rgba(246,241,231,0.72)", letterSpacing: "0.01em" }} aria-hidden>
          {venue.photoCredit}
        </span>
      )}
    </div>
  );
}
