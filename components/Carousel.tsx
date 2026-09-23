"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A horizontal, snap-scrolling deck of cards. Native swipe on the phone
 * (scroll-snap, so it feels like the OS), dots underneath, and the next card
 * peeking in from the right so it's obvious there's more.
 */
export function Carousel({ children, count, labels }: { children: ReactNode; count: number; labels?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !el.firstElementChild) return;
    const card = el.firstElementChild as HTMLElement;
    const step = card.offsetWidth + 12; // gap-3
    setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))));
  }, [count]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el || !el.firstElementChild) return;
    const card = el.firstElementChild as HTMLElement;
    el.scrollTo({ left: i * (card.offsetWidth + 12), behavior: "smooth" });
  };

  return (
    <div>
      <div ref={ref} className="no-scrollbar snap-x -mx-5 flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollPaddingLeft: 20, scrollPaddingRight: 20 }}>
        {children}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="block rounded-full transition-all duration-300"
              style={{ width: i === index ? 18 : 6, height: 6, background: i === index ? "var(--ink)" : "var(--ink-20)" }}
              tabIndex={-1}
            />
          ))}
        </div>
        <p className="text-[12px] font-medium" style={{ color: "var(--ink-55)" }} aria-live="polite">
          {labels?.[index] ? `${labels[index]} · ` : ""}
          {index + 1} of {count}
        </p>
      </div>
    </div>
  );
}
