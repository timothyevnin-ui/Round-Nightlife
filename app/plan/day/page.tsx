import type { Metadata } from "next";
import { NightFlow } from "../night/NightFlow";

export const metadata: Metadata = { title: "Brunch, day drinking, happy hour" };

/** The daylight door. Same flow as a night out, starting from this afternoon. */
export default function Page() {
  return <NightFlow day />;
}
