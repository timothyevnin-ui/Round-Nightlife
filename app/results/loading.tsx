import { Thinking } from "@/components/Thinking";

/** Shown while the results page reads the room (the model takes a few seconds). */
export default function Loading() {
  return (
    <main className="screen mx-auto flex w-full max-w-md flex-col pb-16" style={{ minHeight: "100dvh" }}>
      <header className="flex items-center justify-between pt-4 pb-2">
        <span className="h-11 w-11" />
        <span className="eyebrow">Tonight</span>
        <span className="h-11 w-11" />
      </header>
      <Thinking />
      <div className="mt-8 flex gap-3 overflow-hidden" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="card w-[86%] shrink-0 overflow-hidden" style={{ opacity: i === 0 ? 1 : 0.5 }}>
            <div className="aspect-[4/3] w-full animate-pulse" style={{ background: "rgba(22,33,58,0.08)" }} />
            <div className="p-5">
              <div className="h-6 w-2/3 animate-pulse rounded" style={{ background: "rgba(22,33,58,0.1)" }} />
              <div className="mt-3 h-3.5 w-1/3 animate-pulse rounded" style={{ background: "rgba(22,33,58,0.07)" }} />
              <div className="mt-4 h-3.5 w-full animate-pulse rounded" style={{ background: "rgba(22,33,58,0.07)" }} />
              <div className="mt-2 h-3.5 w-5/6 animate-pulse rounded" style={{ background: "rgba(22,33,58,0.07)" }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
