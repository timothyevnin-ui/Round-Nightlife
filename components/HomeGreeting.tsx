"use client";

import { useSyncExternalStore } from "react";
import { greeting } from "@/lib/time";

const noop = () => () => {};

/** Reflects the phone's clock, not the server's; renders empty on the server to avoid a hydration mismatch. */
export function HomeGreeting() {
  const text = useSyncExternalStore(noop, () => greeting(), () => "");
  return (
    <p className="eyebrow" style={{ minHeight: 14 }} aria-live="polite">
      {text}
    </p>
  );
}
