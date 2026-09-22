"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/components/Flow";
import { dateSteps } from "@/lib/flows";

export function DateFlow() {
  const router = useRouter();
  const { steps, dow } = useMemo(() => dateSteps(), []);
  return (
    <Flow
      title="Date"
      steps={steps}
      onComplete={(a) => {
        const params = new URLSearchParams({ m: "date", n: a.n, s: a.s, dn: a.dn, v: a.v, t: a.t, d: String(dow) });
        router.push(`/results?${params.toString()}`);
      }}
    />
  );
}
