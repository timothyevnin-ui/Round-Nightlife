import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { YouView } from "./YouView";
import { getVenues } from "@/lib/db";
import type { Place } from "@/app/friends/FriendsView";

export const revalidate = 60;

export const metadata: Metadata = { title: "You" };

export default async function YouPage() {
  const venues = await getVenues();
  const places: Record<string, Place> = Object.fromEntries(venues.map((v) => [v.slug, { slug: v.slug, name: v.name, neighborhood: v.neighborhood, photo: v.photo, photoUrl: v.photoUrl }]));
  return (
    <>
      <YouView venues={venues} places={places} />
      <TabBar />
    </>
  );
}
