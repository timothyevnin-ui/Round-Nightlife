"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/** Logs that a page was opened. Renders nothing. */
export function TrackView({ slug, kind = "view" }: { slug: string; kind?: "view" }) {
  useEffect(() => {
    track(kind, { slug });
  }, [slug, kind]);
  return null;
}
