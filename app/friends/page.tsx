import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { getVenues } from "@/lib/db";
import { FriendsView, type Regular } from "./FriendsView";

export const revalidate = 60;
export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage() {
  const venues = await getVenues();
  // Until someone's friends are on ROUND, the room's regulars keep this from feeling empty.
  const regulars: Regular[] = [...venues]
    .filter((v) => (v.friendsBeen ?? 0) >= 3)
    .sort((a, b) => (b.friendsBeen ?? 0) - (a.friendsBeen ?? 0))
    .slice(0, 8)
    .map((v) => ({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, tags: v.tags.slice(0, 2), photo: v.photo, photoUrl: v.photoUrl, regulars: v.friendsBeen ?? 0 }));
  const names: Record<string, string> = Object.fromEntries(venues.map((v) => [v.slug, v.name]));
  return (
    <>
      <FriendsView regulars={regulars} names={names} />
      <TabBar />
    </>
  );
}
