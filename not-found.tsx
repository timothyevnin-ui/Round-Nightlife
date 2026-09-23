import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <main className="screen mx-auto flex w-full max-w-md flex-col" style={{ minHeight: "100dvh" }}>
      <header className="pt-5">
        <Wordmark />
      </header>
      <section className="flex flex-1 flex-col justify-center pb-24">
        <p className="eyebrow">Nothing here</p>
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02 }}>
          That place isn&apos;t on ROUND.
        </h1>
        <p className="mt-3 text-[15px]" style={{ color: "var(--chalk-70)" }}>
          Which usually means something.
        </p>
        <Link href="/" className="pressable btn-primary mt-8 flex h-14 w-full items-center justify-center text-[16px]">
          Where should we go?
        </Link>
      </section>
    </main>
  );
}
