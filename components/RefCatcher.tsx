"use client";

import { useEffect } from "react";
import { captureRef } from "@/lib/referrals";

/** Any page opened from a friend's link (?ref=CODE) keeps the code on this phone for sign-up. Renders nothing. */
export function RefCatcher() {
  useEffect(() => {
    captureRef();
  }, []);
  return null;
}
