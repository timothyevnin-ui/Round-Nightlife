import type { Metadata } from "next";
import { getVenues } from "@/lib/db";
import { NearView, type NearPlace } from "./NearView";

export const metadata: Metadata = { title: "Near me" };
export const revalidate = 60;

export default async function Page() {
  const venues = await getVenues();
  const places: NearPlace[] = venues.map((v) => ({ slug: v.slug, name: v.name, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng }));
  return <NearView places={places} />;
}
