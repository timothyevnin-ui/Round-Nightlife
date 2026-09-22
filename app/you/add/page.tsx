import type { Metadata } from "next";
import { AddView } from "./AddView";
import { getVenues } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = { title: "Add from screenshots" };

export default async function AddPage() {
  return <AddView venues={await getVenues()} />;
}
