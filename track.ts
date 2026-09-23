import type { EventKind } from "./events";

/**
 * Client-side logging. Fire and forget: a beacon when the browser has one,
 * a keepalive fetch otherwise, and never an error in the UI.
 */
export function track(kind: EventKind, fields: { slug?: string; q?: string; data?: Record<string, unknown> } = {}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ kind, ...fields });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}
