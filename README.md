# ROUND

**Where should we go tonight?**

Tell ROUND the kind of night, get three great places in NYC, pick one, tap GO. This is version one: a mobile-first web app that installs to the home screen, works with no account, and is built to grow into the Beli-style ranked list, the friend layer, the phone number, and the nightly census without a rewrite.

---

## What's in this build

| Surface | Route | Notes |
| --- | --- | --- |
| Home | `/` | Two doors: **Night out** and **Date**. Greeting reflects the phone's clock. |
| Night out flow | `/plan/night` | Where → vibe (visual) → how many → when. One question per screen, the blue shifts per step, defaults pre-highlighted, "Just tell me" skips everything. |
| Date flow | `/plan/date` | Where → what kind of date → dinner too? → mood → when. |
| Results | `/results?…` | Three cards: **The pick · Also great · Easy in**. Date mode returns two-stop plans (dinner → short walk → drinks). GO, Want to Go, Share on every card. |
| Venue page | `/v/[slug]` | ROUND's Take, The catch, best for / best time / price / room, I've been + rating. Server-rendered, indexable. |
| Plan link | `/p/[code]` | The share card. Encodes the whole plan in the URL (no database), renders a real Open Graph image for iMessage. |
| YOU | `/you` | Your nightlife map (MapLibre + OpenFreeMap), Want to Go, Been with ratings, taste line. |
| Taste quiz | `/quiz` | Ten iconic bars, swipe or tap: Pass / Want to go / Been / Loved it. Seeds the map and the taste profile. |
| Add from screenshots | `/you/add` | Pick screenshots from the camera roll; Claude reads them and matches places to ROUND's database. Unmatched places go to a local "curation inbox". |
| Friends | `/friends` | Honest empty state, invite button, and "ROUND's regulars" so it isn't an empty room. |
| Best-of pages | `/best/[neighborhood]/[occasion]` | 32 server-rendered SEO pages (the 5pm.nyc-style surface), powered by the same engine. |
| PWA | `manifest.webmanifest`, icons | Installs to the home screen, standalone, chalk-black theme. |

Everything a user does (saves, been, ratings, GO taps, quiz) is stored locally in `localStorage` under `round:v1`. `lib/store.ts` is the seam: swap its read/write for Supabase when phone sign-in arrives and the anonymous history merges into the account.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Open it on your phone: run `npm run dev -- -H 0.0.0.0` and visit your laptop's IP on the same Wi-Fi, or deploy (below) and add it to the home screen.

## Deploy (Vercel, ~5 minutes)

1. Push this folder to a GitHub repo.
2. vercel.com → Add New Project → import the repo. Framework is auto-detected. Build settings need no changes.
3. Environment variables:

| Variable | Required | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes, in production | Absolute URL (e.g. `https://round.nyc`). Used for Open Graph images and the sitemap. |
| `ANTHROPIC_API_KEY` | for screenshots | Turns on **Add from screenshots**. Without it the page explains itself and everything else works. |
| `ROUND_VISION_MODEL` | no | Defaults to `claude-haiku-4-5`. |
| `NEXT_PUBLIC_MAP_STYLE` | no | Defaults to OpenFreeMap's Positron style, darkened with CSS. Any MapLibre style URL works. |

4. Add your domain. ROUND is a company, so use Vercel Pro (Hobby is non-commercial).

## Project layout

```
app/
  page.tsx                  Home
  plan/night, plan/date     Question flows (client) → /results
  results/                  Runs the engine server-side, renders cards
  v/[slug]/                 Venue pages (static)
  p/[code]/                 Plan share page + opengraph-image.tsx
  you/, you/add, quiz/      Personal map, screenshots, taste quiz
  friends/                  Friends tab
  best/[neighborhood]/[occasion]/   SEO pages
  api/screenshots/          Claude vision route
  manifest.ts, sitemap.ts, robots.ts, icon.png, apple-icon.png
components/
  Flow.tsx                  The one-question-per-screen engine
  VenueCard, PlanCard, Actions (GO / Save / Share), Photo, NightMap, TabBar, Wordmark
lib/
  venues.ts                 THE DATABASE (seed, unverified)
  engine.ts                 Deterministic scoring + diversity picks
  neighborhoods.ts          Neighborhoods and adjacency
  flows.ts                  Question definitions
  plan.ts                   Plan encode/decode for share links
  store.ts                  Local-first user state (Supabase seam)
  time.ts, maps.ts, describe.ts, occasions.ts
```

## The database (`lib/venues.ts`)

Every venue is a row with the attributes the engine actually uses:

- `vibe` — `{ lively, chill, talk }`, each 0–1.
- `groupFit` — `{ two, small (3–4), mid (5–7), big (8+) }`, 0–1.
- `dateFit` — `{ first, early, longterm }`, 0–1.
- `bestWindows` — day-of-week + hour ranges (hours may exceed 24 for after midnight).
- `capacity` — tiny / small / medium / large. Big groups are penalized into small rooms.
- `easyIn` — 0–1, how likely you can walk in with a group at peak. Drives the **Easy in** slot.
- `take` — ROUND's Take, one sentence, house voice.
- `theCatch` — the thing Maps doesn't know ("line after 9:30 on Thursdays").
- `perk`, `groupBooking` — empty slots for the membership and ROUND Table phases.
- `verified` — **every seed entry is `false`.** Flip it after a visit.

The 68 seeded places are real, well-known NYC spots described from general reputation so the product can be felt. Treat every attribute, window and Take as a draft to verify against a visit and the venue's own site or Instagram. Nothing is copied from another publication. Photos are placeholder gradients until ROUND has its own photography; the `photo` field is where a real image URL goes.

**To add a venue:** copy a block, fill the attributes from the form-style questions above, write a one-line Take, leave `verified: false`, and it appears in the engine, the map, the venue page, the sitemap and the best-of pages automatically.

## The engine (`lib/engine.ts`)

Night out: `score = neighborhood×0.20 + vibe×0.38 + groupFit×0.24 + timeWindow×0.18`, multiplied by a capacity penalty. Adjacent neighborhoods are allowed at 0.55. Then three slots: the top score is **The pick**; **Also great** is the next best that differs in room size or dominant vibe; **Easy in** is the best remaining place with `easyIn ≥ 0.55` and a room that fits the group.

Date: bars are scored on `dateFit×0.40 + mood×0.35 + neighborhood×0.15 + time×0.10`. With dinner, restaurants are scored the same way, and each of three restaurants is paired with the best bar within ~900 m, timed (dinner at the chosen hour, drinks about 1h45 later, walk time from distance).

Tune the weights there; the best-of pages and results update together.

## Things wired for later, on purpose

- **GO taps are counted per venue** (`goCount` in the store). That's the receipt for partner bars.
- **Plan links are first-class objects** (`lib/plan.ts`). "I'm in" and payments attach to them.
- **Perk and group-booking slots** exist on every venue.
- **The morning-after rating** exists on the venue page (Loved / Good / Meh) and populates the Been list; push notifications turn it into the next-morning nudge once phone sign-in exists.
- **Structured attributes, not prose**, so user ratings can fill the matrix per venue × day × hour × group size.

## Roadmap (from the plan)

1. **Now** — this build. Curate the first 60 venues (verify, photograph), tune the engine, put it in thirty people's hands, watch weekend-two retention.
2. **V1.5** — Supabase: anonymous sessions → phone OTP (Twilio Verify), saves/ratings/plans in Postgres, the ROUND phone number (A2P registration takes a couple of weeks; start it early).
3. **V2** — Nightly census (AI calls to partner bars), "want me to call ahead?", "Did you get in?" check-in 30 minutes after GO, morning-after push.
4. **V3** — Friends (mutual, contact matching), Out Mode, membership perks, ROUND Table.

## Verification checklist before launch

- [ ] Every venue visited or checked; `verified: true`.
- [ ] Hours / windows checked against the venue's own site or Instagram.
- [ ] Real photography in `photo` (own shots; no Google or third-party images).
- [ ] Takes read in ROUND's voice, one sentence, no borrowed phrasing.
- [ ] `NEXT_PUBLIC_SITE_URL` set, share a plan link into iMessage and confirm the card renders.
- [ ] Add to Home Screen on an iPhone; confirm standalone launch and the icon.
- [ ] Age gate (DOB) added at sign-in when accounts arrive.
