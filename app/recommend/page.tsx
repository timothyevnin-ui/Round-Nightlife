import type { Metadata } from "next";
import { RecommendView } from "./RecommendView";

export const metadata: Metadata = {
  title: "Recommend a place",
  description: "Know a bar or restaurant ROUND should know about? Two minutes. We check every one.",
};

export default function RecommendPage() {
  return <RecommendView />;
}
