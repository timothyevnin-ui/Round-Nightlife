import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { YourList } from "@/app/you/lists/YourList";
import { getVenues } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = { title: "Been" };

export default async function Page() {
  const venues = await getVenues();
  return (
    <>
      <YourList kind="been" venues={venues} />
      <TabBar />
    </>
  );
}
