import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { YouView } from "./YouView";

export const metadata: Metadata = { title: "You" };

export default function YouPage() {
  return (
    <>
      <YouView />
      <TabBar />
    </>
  );
}
