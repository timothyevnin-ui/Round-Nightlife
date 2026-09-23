"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/components/Flow";
import { QuickOnes } from "@/components/QuickOnes";
import { nightSteps } from "@/lib/flows";
import { encodeWants, pickDeck, type Wants } from "@/lib/questions";
import { useRoundStore } from "@/lib/store";

/**
 * Night out, and (with `day`) the daylight door: brunch, day drinking, happy
 * hour. Same three steps and the same quick ones, which already change with
 * the hour; the day door just starts from this afternoon instead of tonight.
 */
export function NightFlow({ day = false }: { day?: boolean }) {
  const router = useRouter();
  const { state } = useRoundStore();
  const { steps, dow } = useMemo(() => nightSteps(day ? "day" : "night"), [day]);
  const title = day ? "Day out" : "Night out";
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [seed] = useState(() => Date.now());

  const go = (a: Record<string, string>, wants: Wants) => {
    const params = new URLSearchParams({ m: day ? "day" : "night", n: a.n, g: a.g, t: a.t, d: String(dow) });
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
        title={title}
        steps={steps}
        onComplete={(a, quick) => {
          if (quick) go(a, {});
          else setAnswers(a);
        }}
      />
    );
  }

  const cards = pickDeck({ mode: "night", group: Number(answers.g) || 4, hour: Number(answers.t) || 21, dow, neighborhood: answers.n }, 8, seed);
  return <QuickOnes title={title} cards={cards} onBack={() => setAnswers(null)} onDone={(wants) => go(answers, wants)} />;
}
