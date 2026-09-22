"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/components/Flow";
import { nightSteps } from "@/lib/flows";

export function NightFlow() {
  const router = useRouter();
  const { steps, dow } = useMemo(() => nightSteps(), []);
  return (
    <Flow
      title="Night out"
      steps={steps}
      onComplete={(a) => {
        const params = new URLSearchParams({ m: "night", n: a.n, v: a.v, g: a.g, t: a.t, d: String(dow) });
        router.push(`/results?${params.toString()}`);
      }}
    />
  );
}
