import Link from "next/link";
import { pinProblemWords, type PinProblem } from "@/lib/pins";

/** The pins that can't be right (V35), each a tap from its page. Nothing to show when every pin sits where it should. */
export function PinsCard({ problems }: { problems: PinProblem[] }) {
  if (!problems.length) return null;
  return (
    <div className="card mt-4 px-4 py-3 text-[13.5px]" style={{ color: "var(--ink-70)", borderColor: "rgba(217,72,43,0.45)" }} data-pins-card={problems.length}>
      <strong style={{ color: "var(--ink)" }}>
        {problems.length === 1 ? "One pin looks wrong." : `${problems.length} pins look wrong.`}
      </strong>{" "}
      Every walk time on those cards is off until the pin is. Open the place, retype its name in the Name box and pick it from the list: the real address and pin come with it.
      <ul className="mt-2 flex flex-col gap-1">
        {problems.slice(0, 8).map((p) => (
          <li key={p.slug}>
            <Link href={`/admin/v/${p.slug}`} className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--tomato)" }} data-pin-problem={p.slug}>
              {p.name}
            </Link>
            <span style={{ color: "var(--ink-55)" }}> · {pinProblemWords(p)}</span>
          </li>
        ))}
        {problems.length > 8 && <li style={{ color: "var(--ink-55)" }}>…and {problems.length - 8} more.</li>}
      </ul>
    </div>
  );
}
