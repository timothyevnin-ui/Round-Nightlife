import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { Wordmark } from "@/components/Wordmark";
import { HomeGreeting } from "@/components/HomeGreeting";
import { ModeCard } from "@/components/ModeCard";
import { SayIt } from "@/components/SayIt";

export default function Home() {
  return (
    <main
      className="screen mx-auto flex w-full max-w-md flex-col"
      style={{
        height: "100dvh",
        paddingBottom: "calc(var(--tab-height) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <header className="flex items-center justify-between pt-4 pb-1">
        <Wordmark />
        <Link href="/you" className="pressable eyebrow" style={{ color: "var(--chalk-35)" }}>
          NYC
        </Link>
      </header>

      <section className="pt-6 pb-5">
        <HomeGreeting />
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          Where should
          <br />
          we go?
        </h1>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <ModeCard
          href="/plan/night"
          label="Night out"
          sub="Friends, a group, somewhere lively or somewhere you can talk."
          gradient="linear-gradient(160deg, #1a2fb8 0%, #2b4dff 55%, #4c6fff 100%)"
          delay={0}
        />
        <ModeCard
          href="/plan/date"
          label="Date"
          sub="Dinner and drinks after, or just the right bar."
          gradient="linear-gradient(160deg, #0f1a5c 0%, #16289a 60%, #1d37c4 100%)"
          delay={0.06}
        />
      </section>

      <div className="shrink-0 pt-3 pb-1">
        <SayIt />
      </div>

      <TabBar />
    </main>
  );
}
