import type { Metadata } from "next";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { Photo } from "@/components/Photo";
import { InviteButton } from "./InviteButton";
import { VENUES } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  // Until the friend graph exists, ROUND's own regulars keep this from being an empty room.
  const regulars = [...VENUES].filter((v) => (v.friendsBeen ?? 0) >= 3).sort((a, b) => (b.friendsBeen ?? 0) - (a.friendsBeen ?? 0)).slice(0, 8);

  return (
    <>
      <main className="screen screen-with-tabs mx-auto w-full max-w-md">
        <header className="pt-5 pb-4">
          <p className="eyebrow">Mutual, not public</p>
          <h1 className="serif mt-1" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Friends
          </h1>
        </header>

        <section className="card p-5">
          <p className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>
            Your friends aren&apos;t on ROUND yet.
          </p>
          <p className="mt-2 text-[14.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
            When they are, their nights out quietly shape your three places: &ldquo;2 friends have been,&rdquo; &ldquo;Victoria rated this highly.&rdquo; No feed, no followers, no performance.
          </p>
          <InviteButton />
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="serif" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
              ROUND&apos;s regulars
            </h2>
            <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
              Where the room keeps going back
            </span>
          </div>
          <div className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {regulars.map((v) => (
              <Link key={v.slug} href={`/v/${v.slug}`} className="pressable flex items-center gap-3 py-3" style={{ borderColor: "var(--hairline)" }}>
                <Photo venue={v} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {v.name}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                    {neighborhoodName(v.neighborhood)} · {v.tags.slice(0, 2).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--chalk-55)" }}>
                  {v.friendsBeen} regulars
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <TabBar />
    </>
  );
}
