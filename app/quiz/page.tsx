import type { Metadata } from "next";
import { QuizView } from "./QuizView";

export const metadata: Metadata = { title: "Taste quiz" };

export default function QuizPage() {
  return <QuizView />;
}
