import { TabBar } from "@/components/TabBar";
import { HomeHero } from "@/components/HomeHero";
import { HotShelf } from "@/components/HotShelf";
import { CityRank } from "@/components/CityRank";
import { InstallHint } from "@/components/InstallHint";
import { HelpCard } from "@/components/HelpCard";
import { HowWasIt } from "@/components/HowWasIt";
import { getVenues } from "@/lib/db";
import { hotVenues } from "@/lib/hot";
import { rankVenues, ratersOf } from "@/lib/rank";

export const revalidate = 60;

/**
 * The front door at night (V33): the question and the ask box, Bars near
 * me, "How was it?" the morning after a GO, What's hot (the blog: where ROUND
 * went this week), the ask for the city's help, and the city's ranking.
 */
export default async function Home() {
  const venues = await getVenues();
  const hot = hotVenues(venues);
  const names = Object.fromEntries(venues.map((v) => [v.slug, v.name]));
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <HomeHero />
      <HowWasIt names={names} />
      <HotShelf venues={hot.slice(0, 8)} />
      <HelpCard />
      <CityRank rows={rankVenues(venues, 5)} raters={ratersOf(venues)} href="/best" />
      <InstallHint />
      <TabBar />
    </main>
  );
}
