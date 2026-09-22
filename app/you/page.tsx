import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { YouView } from "./YouView";
import { getVenues } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = { title: "You" };

export default async function YouPage() {
  const venues = await getVenues();
  return (
    <>
      <YouView venues={venues} />
      <TabBar />
    </>
  );
}
