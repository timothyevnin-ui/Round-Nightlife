import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getVenuesWithSource } from "@/lib/db";
import { hotVenues } from "@/lib/hot";
import { neighborhoodName } from "@/lib/neighborhoods";
import { StoryPicker } from "./StoryPicker";

export const dynamic = "force-dynamic";

/** The blog: what's on the shelf, what's written, and a way to start a new one. */
export default async function StoriesPage() {
  await requireAdmin();
  const { venues: every } = await getVenuesWithSource();
  const venues = every.filter((v) => !v.retired);
  const shelf = hotVenues(venues);
  const written = venues.filter((v) => v.story && !v.hot).sort((a, b) => a.name.localeCompare(b.name));
  const options = venues.map((v) => ({ slug: v.slug, name: v.name, hood: neighborhoodName(v.neighborhood) })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="screen pb-16 pt-6">
      <p className="eyebrow">Stories</p>
      <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }}>
        The shelf, and the blog behind it.
      </h1>
      <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
        A story is the long read on a place. Flip it on and it shows on the home page in the order below. Paragraphs are separated by a blank line; the first one is set in serif.
      </p>

      <StoryPicker options={options} />

      <section className="mt-8">
        <h2 className="serif" style={{ fontSize: 22 }}>
          On the shelf
        </h2>
        {shelf.length === 0 ? (
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-35)" }}>
            Nothing yet. Pick a place above and write.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {shelf.map((v, i) => (
              <li key={v.slug}>
                <Link href={`/admin/stories/${v.slug}`} className="pressable flex items-center gap-4 py-3">
                  <span className="serif w-6 text-[18px]" style={{ color: "var(--ink-35)" }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="serif block truncate text-[19px]">{v.name}</span>
                    <span className="block truncate text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                      {neighborhoodName(v.neighborhood)} · {v.story ? `${v.story.split(/\s+/).length} words` : "no story yet"}
                    </span>
                  </span>
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
                    Edit
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {written.length > 0 && (
        <section className="mt-8">
          <h2 className="serif" style={{ fontSize: 22 }}>
            Written, not on the shelf
          </h2>
          <ul className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {written.map((v) => (
              <li key={v.slug}>
                <Link href={`/admin/stories/${v.slug}`} className="pressable flex items-center justify-between py-3">
                  <span className="serif text-[19px]">{v.name}</span>
                  <span className="text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                    {v.story!.split(/\s+/).length} words
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
