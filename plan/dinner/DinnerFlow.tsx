"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/components/Flow";
import { QuickOnes } from "@/components/QuickOnes";
import { dinnerSteps } from "@/lib/flows";
import { encodeWants, pickDeck, type Wants } from "@/lib/questions";
import { useRoundStore } from "@/lib/store";

/** Dinner with the group, then a bar that fits all of you. */
export function DinnerFlow() {
  const router = useRouter();
  const { state } = useRoundStore();
  const { steps, dow } = useMemo(() => dinnerSteps(), []);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [seed] = useState(() => Date.now());

  const go = (a: Record<string, string>, wants: Wants) => {
    const params = new URLSearchParams({ m: "dinner", n: a.n, g: a.g, t: a.t, d: String(dow) });
    const w = encodeWants(wants);
    if (w) params.set("w", w);
    if ((wants.new ?? 0) > 0) {
      const been = Object.keys(state.been);
      if (been.length) params.set("b", been.join(","));
    }
    router.push(`/results?${params.toString()}`);
  };

  if (!answers) {
    return (
      <Flow
        title="Dinner & drinks"
        steps={steps}
        onComplete={(a, quick) => {
          if (quick) go(a, {});
          else setAnswers(a);
        }}
      />
    );
  }

  const cards = pickDeck({ mode: "dinner", group: Number(answers.g) || 4, hour: Number(answers.t) || 20, dow, neighborhood: answers.n }, 7, seed);
  return <QuickOnes title="Dinner & drinks" cards={cards} onBack={() => setAnswers(null)} onDone={(wants) => go(answers, wants)} />;
}
