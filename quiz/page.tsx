import type { Metadata } from "next";
import { QuizView } from "./QuizView";
import { getVenues } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = { title: "Taste quiz" };

export default async function QuizPage() {
  return <QuizView venues={await getVenues()} />;
}
