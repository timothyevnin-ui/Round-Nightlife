import type { Metadata } from "next";
import { Suspense } from "react";
import { getVenues } from "@/lib/db";
import { toSearchEntry } from "@/lib/searchIndex";
import { SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Search", description: "Look up a bar or restaurant on ROUND and read our take." };
export const revalidate = 60;

export default async function SearchPage() {
  const venues = await getVenues();
  const index = venues.map(toSearchEntry);
  return (
    <Suspense fallback={null}>
      <SearchView index={index} />
    </Suspense>
  );
}
