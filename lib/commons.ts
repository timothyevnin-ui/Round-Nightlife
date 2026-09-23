/**
 * Wikimedia Commons: the one big photo library where the license is part of
 * the record. We only surface photos that are free to reuse (public domain,
 * CC0, CC BY, CC BY-SA) and we carry the credit with the photo.
 *
 * Google Images is a search engine over other people's copyrighted pictures;
 * its terms and theirs don't allow copying them into an app. Commons does.
 */

export type CommonsPhoto = {
  /** File title on Commons, e.g. "File:McSorley's Old Ale House.jpg". */
  title: string;
  /** ~800px-wide rendering, good for cards. */
  thumb: string;
  /** Original file. */
  original: string;
  width: number;
  height: number;
  mime: string;
  license: string;
  licenseUrl?: string;
  artist: string;
  /** The line we store and show: "Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons". */
  credit: string;
  /** Page on Commons, for the back office to double-check. */
  page: string;
  description?: string;
};

const UA = "ROUND nightlife app (round-nightlife.vercel.app; back office photo search)";

const OK_LICENSE = /^(cc0|public domain|pd|cc[- ]by(?:[- ]sa)?(?:[- ]\d(\.\d)?)?(?:[- ][a-z]{2})?|attribution)/i;
const BAD_LICENSE = /\bnc\b|\bnd\b|non-?commercial|no-?deriv|fair use|non-free|copyright|all rights/i;

type ApiPage = {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    width: number;
    height: number;
    mime: string;
    descriptionshorturl?: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
};

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeLicense(raw: string): string {
  const s = raw.trim();
  if (/^cc0/i.test(s)) return "CC0";
  if (/public domain|^pd/i.test(s)) return "Public domain";
  const m = s.match(/cc[- ]?by(?:[- ]?sa)?(?:[- ]?(\d(?:\.\d)?))?/i);
  if (m) return `CC BY${/sa/i.test(m[0]) ? "-SA" : ""}${m[1] ? ` ${m[1]}` : ""}`;
  return s;
}

export function licenseOk(raw: string): boolean {
  if (!raw) return false;
  if (BAD_LICENSE.test(raw)) return false;
  return OK_LICENSE.test(raw.trim());
}

function toPhoto(p: ApiPage): CommonsPhoto | null {
  const ii = p.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime)) return null;
  const meta = ii.extmetadata ?? {};
  const licenseRaw = meta.LicenseShortName?.value ?? meta.License?.value ?? "";
  if (!licenseOk(licenseRaw)) return null;
  const license = normalizeLicense(licenseRaw);
  const artist = stripHtml(meta.Artist?.value ?? meta.Credit?.value ?? "").slice(0, 60) || "Unknown";
  const credit = `Photo: ${artist} · ${license} · Wikimedia Commons`;
  if (ii.width < 500 || ii.height < 400) return null;
  return {
    title: p.title,
    thumb: ii.thumburl ?? ii.url,
    original: ii.url,
    width: ii.width,
    height: ii.height,
    mime: ii.mime,
    license,
    licenseUrl: meta.LicenseUrl?.value,
    artist,
    credit,
    page: ii.descriptionshorturl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    description: meta.ImageDescription?.value ? stripHtml(meta.ImageDescription.value).slice(0, 140) : undefined,
  };
}

/** Search Commons for photos of a place. Free-license results only. */
export async function searchCommons(query: string, limit = 12): Promise<CommonsPhoto[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: q,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(30, limit * 2)),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "900",
    iiextmetadatafilter: "LicenseShortName|License|LicenseUrl|Artist|Credit|ImageDescription",
    origin: "*",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Commons search failed (${res.status}).`);
  const json = (await res.json()) as { query?: { pages?: Record<string, ApiPage> } };
  const pages = Object.values(json.query?.pages ?? {});
  return pages
    .map(toPhoto)
    .filter((p): p is CommonsPhoto => p !== null)
    .slice(0, limit);
}

/** Download a Commons rendering (the ~900px thumb) as bytes for our own bucket. */
export async function fetchCommonsBytes(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(url)) throw new Error("Only Wikimedia files can be copied.");
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't download the photo (${res.status}).`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!/^image\/(jpeg|png|webp)/.test(contentType)) throw new Error("That file isn't a photo.");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 12 * 1024 * 1024) throw new Error("That photo is too big to copy.");
  return { bytes, contentType: contentType.split(";")[0] };
}
