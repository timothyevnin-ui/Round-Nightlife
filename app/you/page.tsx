import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { YouView } from "./YouView";
import { getVenues } from "@/lib/db";
import type { Place, Regular } from "@/app/friends/FriendsView";

export const revalidate = 60;

export const metadata: Metadata = { title: "You" };

export default async function YouPage() {
  const venues = await getVenues();
  // Until someone's friends are on ROUND, the room's regulars keep the friends block from feeling empty.
  const regulars: Regular[] = [...venues]
    .filter((v) => (v.friendsBeen ?? 0) >= 3)
    .sort((a, b) => (b.friendsBeen ?? 0) - (a.friendsBeen ?? 0))
    .slice(0, 8)
    .map((v) => ({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, tags: v.tags.slice(0, 2), photo: v.photo, photoUrl: v.photoUrl, regulars: v.friendsBeen ?? 0 }));
  const places: Record<string, Place> = Object.fromEntries(venues.map((v) => [v.slug, { slug: v.slug, name: v.name, neighborhood: v.neighborhood, photo: v.photo, photoUrl: v.photoUrl }]));
  return (
    <>
      <YouView venues={venues} regulars={regulars} places={places} />
      <TabBar />
    </>
  );
}
