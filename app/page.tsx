import { TabBar } from "@/components/TabBar";
import { HomeHero } from "@/components/HomeHero";
import { HotShelf } from "@/components/HotShelf";
import { CityRank } from "@/components/CityRank";
import { InstallHint } from "@/components/InstallHint";
import { getVenues } from "@/lib/db";
import { hotVenues } from "@/lib/hot";
import { rankVenues, ratersOf } from "@/lib/rank";

export const revalidate = 60;

/**
 * The front door at night (V33): the question and the ask box, Bars near
 * me, What's hot (the blog: where ROUND went this week), and the city's
 * ranking. Nothing else.
 */
export default async function Home() {
  const venues = await getVenues();
  const hot = hotVenues(venues);
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <HomeHero />
      <HotShelf venues={hot.slice(0, 8)} />
      <CityRank rows={rankVenues(venues, 5)} raters={ratersOf(venues)} href="/best" />
      <InstallHint />
      <TabBar />
    </main>
  );
}
