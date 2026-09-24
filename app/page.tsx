import { TabBar } from "@/components/TabBar";
import { HomeHero } from "@/components/HomeHero";
import { Doors } from "@/components/Doors";
import { HotShelf } from "@/components/HotShelf";
import { InstallHint } from "@/components/InstallHint";
import { getVenues } from "@/lib/db";
import { hotVenues } from "@/lib/hot";

export const revalidate = 60;

export default async function Home() {
  const hot = hotVenues(await getVenues());
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <HomeHero />
      <Doors />
      <HotShelf venues={hot.slice(0, 6)} />
      <InstallHint />
      <TabBar />
    </main>
  );
}
