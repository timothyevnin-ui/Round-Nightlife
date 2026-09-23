import { TabBar } from "@/components/TabBar";
import { HomeHero } from "@/components/HomeHero";
import { HotShelf } from "@/components/HotShelf";
import { getVenues } from "@/lib/db";
import { hotVenues } from "@/lib/hot";

export const revalidate = 60;

export default async function Home() {
  const hot = hotVenues(await getVenues());
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <HomeHero hotCount={hot.length} />
      <HotShelf venues={hot.slice(0, 6)} />
      <TabBar />
    </main>
  );
}
