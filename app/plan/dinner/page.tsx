import type { Metadata } from "next";
import { DinnerFlow } from "./DinnerFlow";

export const metadata: Metadata = { title: "Dinner & drinks" };

export default function Page() {
  return <DinnerFlow />;
}
