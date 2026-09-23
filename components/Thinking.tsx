"use client";

import { useEffect, useState } from "react";
import { useTypewriter } from "./QuickOnes";

const LINES = ["Reading the room.", "Thinking about who you are tonight.", "Picking your six."];

/** Types a line at a time while the picks are being made. */
export function Thinking() {
  const [i, setI] = useState(0);
  const line = LINES[Math.min(i, LINES.length - 1)];
  const typed = useTypewriter(line, 40);
  const done = typed.length >= line.length;
  useEffect(() => {
    if (!done || i >= LINES.length - 1) return;
    const id = window.setTimeout(() => setI((k) => k + 1), 1100);
    return () => window.clearTimeout(id);
  }, [done, i]);
  return (
    <section className="pt-2 pb-2" aria-live="polite">
      <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.02, letterSpacing: "-0.02em", minHeight: "2.1em" }}>
        {typed}
        <span aria-hidden className="inline-block align-baseline" style={{ width: 3, height: "0.85em", marginLeft: 3, background: done ? "transparent" : "var(--tomato)", transform: "translateY(0.1em)" }} />
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--ink-35)" }}>
        ROUND knows every room on the list. One second.
      </p>
    </section>
  );
}
