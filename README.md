# ROUND

**Where should we go tonight?**

Tell ROUND the kind of night, get three great places in NYC, pick one, tap GO. This is version one: a mobile-first web app that installs to the home screen, works with no account, and is built to grow into the Beli-style ranked list, the friend layer, the phone number, and the nightly census without a rewrite.

---

## What's in this build

| Surface | Route | Notes |
| --- | --- | --- |
| Home | `/` | **Or just say it** and **Near me** right under the headline, then the doors: **Night out** and **Date night** side by side, **Dinner & drinks** for the group underneath. Scroll and the hero eases into **What's hot right now**. The shelf is always there: three dashed slots until the first story is written in the back office. At the bottom, **Know a spot we don't?** |
| What's hot | `/hot` | The full shelf. Every entry links to its story on the venue page. |
| Night out flow | `/plan/night` | **Where** is a tap-able map of the city (Manhattan and Brooklyn drawn separately, the neighborhood lights up). **How many** is a scroll wheel. **When** is an evening dial: drag from happy hour to after hours and the sky changes. Then **the quick ones**: each question types itself out and two or three buttons appear. Do you want to dance? → Loud or not? → Seats or standing? → Would you wait in a line? → Want a happy hour deal? (daytime only) → $ / $$ / $$$ → Outside if it's nice? then a couple chosen for the night (game on, how late, birthday, cocktails or beers, rooftop or basement …). "Show me now" at any point. |
| Date flow | `/plan/date` | Same map / dial, then the date questions (hear each other? candlelit or bright? somewhere to impress? wine or cocktails? …). |
| Dinner & drinks | `/plan/dinner` | For a group: map → how many for dinner (wheel) → dinner time (dial), then questions about the table. Results are two-stop plans sized for the group. |
| **Near me** | `/near` | Allow location, or type an address or a corner. Eight bars sorted by the walk, in the same swipe carousel, with "4 min walk" on each card. |
| Just say it | Home | Type "six of us in the West Village, want to dance, no line" and it becomes the same query. Keyword parser always; Claude when `ANTHROPIC_API_KEY` is set. |
| **Recommend a place** | `/recommend` | Anyone can send one: the name, where (map), twelve quick questions about the place (typed out, buttons), one line on the move there, optional name. Lands in the back-office inbox. Honeypot-protected, capped, nothing public. |
| **Back office** | `/admin` | PIN-protected (`ROUND_ADMIN_PIN`). Add and edit places on your phone: tags, every attribute as No / Some / Yes, group and date fit, room, hours, Take, the catch, private notes, photo (upload yours, or **Find a photo** on Wikimedia Commons with the license and credit carried along), verified, and **What's hot right now** (on the shelf, order, and the story: the blog). **Recommendations** inbox at `/admin/suggestions`: Add as a place (the form opens pre-filled from their answers) or Not for us. Saves go live within a minute. See **SUPABASE.md**. |
| Results | `/results?…` | **Six cards you swipe through**: The pick · Also great · Easy in, then three more with a reason each (Late one, Cheap and good, Splurge, Big room, Classic, Sleeper). Each card has the photo, the Take, the catch, price, room, getting in, best time, and GO / Want to Go / Share. Date and Dinner modes return two-stop plans. |
| Venue page | `/v/[slug]` | ROUND's Take, The catch, best for / best time / price / room, I've been + rating. Server-rendered, indexable. |
| Plan link | `/p/[code]` | The share card. Encodes the whole plan in the URL (no database), renders a real Open Graph image for iMessage. |
| YOU | `/you` | Your nightlife map (MapLibre + OpenFreeMap), Want to Go, Been with ratings, taste line, and your account. |
| **Accounts** | sheet, anywhere | Phone number → six-digit text → first name + birthday (21+). Asked for the first time you save or rate something, always skippable. Saves, ratings and GO taps sync to the account; signing in on a new phone merges the two histories. Supabase Auth + Twilio Verify, see **SUPABASE.md §7**. |
| Taste quiz | `/quiz` | Ten iconic bars, swipe or tap: Pass / Want to go / Been / Loved it. Seeds the map and the taste profile. |
| Add from screenshots | `/you/add` | Pick screenshots from the camera roll; Claude reads them and matches places to ROUND's database. Unmatched places go to a local "curation inbox". |
| Friends | `/friends` | Honest empty state, invite button, and "ROUND's regulars" so it isn't an empty room. |
| Best-of pages | `/best/[neighborhood]/[occasion]` | 32 server-rendered SEO pages (the 5pm.nyc-style surface), powered by the same engine. |
| PWA | `manifest.webmanifest`, icons | Installs to the home screen, standalone, chalk-black theme. |

Everything a user does (saves, been, ratings, GO taps, quiz) is stored locally in `localStorage` under `round:v1`, so the app works with no account and no network. When someone signs in, `lib/auth.tsx` registers a remote adapter on the store (`lib/sync.ts`) that mirrors every write to Supabase (`saves`, `go_taps`, row-level security per user) and merges the account's history into the phone's. Sign-out clears the phone; the account keeps everything.

Venue data comes from Supabase when it's configured (`lib/db.ts`, cached a minute and refreshed instantly after a back-office save) and from the built-in seed otherwise.

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
| `ROUND_VISION_MODEL` | no | Defaults to `claude-haiku-4-5-20251001`. |
| `NEXT_PUBLIC_MAP_STYLE` | no | Defaults to OpenFreeMap's Positron style, darkened with CSS. Any MapLibre style URL works. |
| `ROUND_ADMIN_PIN` | for the back office | The PIN that opens `/admin`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | for editing | See SUPABASE.md. Without them the app runs on the seed and the back office is read-only. |

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
  venues.ts                 The seed (68 places, unverified) — the fallback and the one-tap import
  db.ts                     Supabase reads/writes with seed fallback
  attrs.ts                  The attribute registry (28 keys) — deck, "say it", and back office all speak this
  questions.ts              The deck: card bank, context rules, wants encoding
  interpret.ts              "Just say it" keyword parser + model prompt
  engine.ts                 Deterministic scoring on wants + diversity picks
  neighborhoods.ts          Neighborhoods and adjacency
  flows.ts                  Question definitions
  plan.ts                   Plan encode/decode for share links
  store.ts                  Local-first user state, with the remote seam
  auth.tsx, sync.ts         Phone sign-in (Supabase Auth) and account sync
  supabase.ts, phone.ts     Browser client; phone formatting and age check
  time.ts, maps.ts, describe.ts, occasions.ts
```

## The look

Cream paper, navy ink, hunter green, a red stripe. Tokens live at the top of `app/globals.css` (`--paper`, `--ink`, `--pine`, `--tomato`, `--butter`); photos and question cards stay deep and saturated so they read as pictures against the paper, and anything drawn on them uses `--on-photo`. The old `--chalk*`/`--cobalt` names are aliased to the new ones so nothing breaks.

## The venue data

The back office is the way to add and edit places (no file editing). Under the hood every venue is a row with the attributes the engine actually uses:

- `attrs` — 28 attributes, each 0–1 (No / Some / Yes in the back office).
- `groupFit` — `{ two, small (3–4), mid (5–7), big (8+) }`, 0–1.
- `dateFit` — `{ first, early, longterm }`, 0–1.
- `bestWindows` — day-of-week + hour ranges (hours may exceed 24 for after midnight).
- `capacity` — tiny / small / medium / large. Big groups are penalized into small rooms.
- `easyIn` — 0–1, how likely you can walk in with a group at peak. Drives the **Easy in** slot.
- `take` — ROUND's Take, one sentence, house voice.
- `theCatch` — the thing Maps doesn't know ("line after 9:30 on Thursdays").
- `perk`, `groupBooking` — empty slots for the membership and ROUND Table phases.
- `verified` — **every seed entry is `false`.** Flip it after a visit.
- `hot`, `hotRank`, `story` — the "What's hot right now" shelf and the long-form write-up behind each entry. Six seed entries have draft stories (`lib/stories.ts`) so the shelf has a shape; rewrite them.

The 68 seeded places are real, well-known NYC spots described from general reputation so the product can be felt. Treat every attribute, window and Take as a draft to verify against a visit and the venue's own site or Instagram. Nothing is copied from another publication. Photos are placeholder gradients until ROUND has its own photography; the `photo` field is where a real image URL goes.

**To add a venue:** open `/admin` on your phone → **Add a place**. It appears in the engine, the map, the venue page, the sitemap and the best-of pages within a minute. (Developers can also add to the seed in `lib/venues.ts`.)

## The engine (`lib/engine.ts`)

Every venue carries 28 attributes (0–1): lively, talk, chill, dance, liveMusic, sports, seating, outdoor, rooftop, speakeasy, classic, dive, upscale, scene, cocktails, beer, wine, frozen, food, cheap, dressy, late, happyHour, social, date, groups, activity, lgbtq. The deck and "just say it" both produce **wants**: a map of attribute → −1..1.

Night out: `score = neighborhood×0.18 + groupFit×0.22 + timeWindow×0.14 + prefs×0.46`, times a capacity penalty, a line penalty (when "no line" was asked for, scaled by `easyIn`), and a been-there penalty (when "somewhere new" was asked for). `prefs` is the average of `want × (attr − 0.5) × 2` over answered wants, so an unanswered attribute never counts. Then three slots: **The pick**, **Also great** (differs in room size or dominant energy), **Easy in** (best remaining place you can actually walk into).

Date: `dateFit×0.38 + prefs×0.40 + neighborhood×0.12 + time×0.10`, with a small built-in lean toward date-y rooms. With dinner, three restaurants are paired with the best bar within ~900 m and timed.

The weights live at the top of `engine.ts`. Dinner & drinks (groups): restaurants scored on `neighborhood×0.18 + groupFit×0.32 + time×0.12 + prefs×0.38` with the capacity penalty, each paired with the best bar within ~900 m that also fits the group.

Every mode returns six: the best, a genuinely different second, one you can walk into, then the next best with a one-word reason each. The card bank and the rules for which cards show (game nights, big groups, late hours) live in `lib/questions.ts`.

Tune the weights there; the best-of pages and results update together.

## The back office

`/admin`, PIN-protected. Built for a phone. Every place has: basics (name, neighborhood, kind, address with a Find button for coordinates), ROUND's Take, the catch, private notes, a "Draft the Take from my notes" button (Claude, in the house voice, only from the facts you give it), tags, all 28 attributes as No / Some / Yes, group and date fit, room size, getting-in-at-peak, price, best hours, a photo, verified, and a member-perk slot. "Import 68 seed" copies the built-in places into the database once.

**Photos.** Two ways in. Upload your own (best: shot at night, in the room). Or **Find a photo**: it searches Wikimedia Commons and shows only pictures whose license allows reuse (public domain, CC0, CC BY, CC BY-SA), copies the one you pick into ROUND's own storage, and stores the credit line ("Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons"), which shows small on the photo. Google Images isn't an option on purpose: those pictures belong to whoever took them and Google's terms don't allow copying them into an app; the famous rooms are usually on Commons, the rest want your phone.

**Recommendations.** `/admin/suggestions` lists what people sent from "Know a spot we don't?". Each card shows the name, neighborhood, address, their one line, and their answers as chips. *Add as a place* opens the new-place form with the name, neighborhood, address, traits, price, getting-in, and fit already set from their answers, and their note in your private notes; saving marks the recommendation as added. *Not for us* files it away (Show all brings everything back).

## Things wired for later, on purpose

- **GO taps are counted per venue** (`goCount` in the store). That's the receipt for partner bars.
- **Plan links are first-class objects** (`lib/plan.ts`). "I'm in" and payments attach to them.
- **Perk and group-booking slots** exist on every venue.
- **The morning-after rating** exists on the venue page (Loved / Good / Meh) and populates the Been list; with phone numbers in hand, the next-morning text is a cron job away.
- **Structured attributes, not prose**, so user ratings can fill the matrix per venue × day × hour × group size.

## Roadmap (from the plan)

1. **Now** — this build. Curate the first 60 venues (verify, photograph), tune the engine, put it in thirty people's hands, watch weekend-two retention.
2. **V1.5** — Done: phone OTP accounts (Twilio Verify), saves/ratings/GO taps in Postgres. Next: plans in Postgres, the ROUND phone number (A2P registration takes a couple of weeks; start it early).
3. **V2** — Nightly census (AI calls to partner bars), "want me to call ahead?", "Did you get in?" check-in 30 minutes after GO, morning-after push.
4. **V3** — Friends (mutual, contact matching), Out Mode, membership perks, ROUND Table.

## Verification checklist before launch

- [ ] Every venue visited or checked; `verified: true`.
- [ ] Hours / windows checked against the venue's own site or Instagram.
- [ ] Real photography in `photo` (own shots; no Google or third-party images).
- [ ] Takes read in ROUND's voice, one sentence, no borrowed phrasing.
- [ ] `NEXT_PUBLIC_SITE_URL` set, share a plan link into iMessage and confirm the card renders.
- [ ] Add to Home Screen on an iPhone; confirm standalone launch and the icon.
- [x] Age gate (birthday, 21+) at sign-in.
