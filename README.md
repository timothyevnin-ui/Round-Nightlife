# ROUND

**Where should we go tonight?**

Tell ROUND the kind of night, get three great places in NYC, pick one, tap GO. This is version one: a mobile-first web app that installs to the home screen, works with no account, and is built to grow into the Beli-style ranked list, the friend layer, the phone number, and the nightly census without a rewrite.

---

## What's in this build

| Surface | Route | Notes |
| --- | --- | --- |
| **The night has chapters** | quick ones + the picker | The first question knows what time it is. At 7:45 the night is getting started, so the run is *Getting the night started, or is this the night? → Eating too, or just drinks? → Somewhere to talk, or something with a pulse? → Seats or standing?* Around 9 it wants a pulse: *Lively, or somewhere to sit and talk? → Feel like dancing later?* After 10:30 it's the night itself: *Do you want to dance? → DJ or a band? → How late are we going? → Would you wait in a line?* Claude gets the same cue (early / mid / late / after midnight) with each pick. No dress code anywhere; the question is **Bougie or chill?** |
| **It only gets smarter** | everywhere | ROUND remembers how you answer the quick ones: answer the same way twice and the third time that button wears a little **usually** tag and leads. Your usual answers, your ladder, your never-agains and the words you use ride along in the taste cookie, so Claude picks with them. Sign in and it learns your name: Home says *Where should we go, Tim?* and the picker can say *Tim, we heard…*. YOU has **What ROUND knows about you**: the receipt, one line per thing, so people see it learning. The Friends pitch sells it (*It only gets smarter*), and every rating ends with a line saying so. |
| **Near, with no specifics** | Near me / "bars near Bayard's" | When someone just names a spot, the ranking system decides: ✓ verified places first, then the shortest walk, then ROUND's score, "good right now" as the tiebreak. The place they're standing at is never one of the six. Claude is told the same rule and sees the walk time on every hint. With specifics ("near Bayard's, dancing"), what they asked for weighs in again. Two Hudson St entries came in with this: White Horse Tavern and Bayard's Ale House. |
| **Address → neighborhood (Studio)** | `/admin/add`, editor | Type the address and, a beat later, ROUND finds it: the pin lands on the map and the neighborhood picks itself ("Found it: East Village. Pin set."). Outside the neighborhoods ROUND covers, it says so and asks you to pick the nearest. The editor's **Find** does the same. Geocoding is OpenStreetMap's Nominatim (back office only, low volume); `ROUND_GEOCODER_URL` points it elsewhere if you ever need to. |
| **About you** | sign-in, YOU | After the name and birthday, a few quick ones, every one skippable: a photo, where you're from, your favorite bar in the city (typed with suggestions from our places; if it's one of ours it's stored by slug and **the picker leans toward that DNA**), your favorite restaurant, and three fun ones (drink order, first to leave or last call, karaoke song). Each answer saves as you go. On YOU, the account card shows the photo and the answers, with **Edit** to change any of them. Friends see the photo and the hometown next to the name; nobody sees a phone or a birthday. Photos go to a public `avatars` bucket where each person can only write their own folder (schema.sql V14). |
| **Home** | `/` | ROUND, then **Search our bars** and NYC up top; "It's Wednesday."; *Where should we go?* (with your name once you're signed in); Just say it and Near me; four doors: Night out, Date night, Dinner & drinks, and a slim fourth, **Brunch, day drinking, happy hour**. No time picker and no plan-ahead: the phone's clock decides. Night out and Just say it mean tonight (9 while it's still daytime, now in the evening; "tn" and "tonight" mean the same, "brunch", "day drinking", "happy hour" and "this afternoon" mean daytime). The day door starts from this afternoon (tomorrow at 1 if the day's over), asks the day questions (sun or shade, lazy or proper, a deal, a game, food), and its results say **Day out**. |
| Home | `/` | **Or just say it** and **Near me** right under the headline, then the doors: **Night out** and **Date night** side by side, **Dinner & drinks** for the group underneath. Scroll and the hero eases into **What's hot right now**. The shelf is always there: three dashed slots until the first story is written in the back office. At the bottom, **Know a spot we don't?** |
| What's hot | `/hot` | The full shelf. Every entry links to its story on the venue page. |
| Night out flow | `/plan/night` | **Where** is a real map (streets and water from OpenFreeMap) with the eight neighborhoods drawn on top; tap one and it lights up. If the tiles can't load, the shapes still draw on paper. **How many** is a scroll wheel. **When** is an evening dial: drag from happy hour to after hours and the sky changes. Then **the quick ones**: each question types itself out and two or three buttons appear. Do you want to dance? → Loud or not? → Seats or standing? → Would you wait in a line? → Want a happy hour deal? (daytime only) → $ / $$ / $$$ → Outside if it's nice? then a couple chosen for the night (game on, how late, birthday, cocktails or beers, rooftop or basement …). "Show me now" at any point. |
| Date flow | `/plan/date` | Same map / dial, then the date questions (hear each other? candlelit or bright? somewhere to impress? wine or cocktails? …). |
| Dinner & drinks | `/plan/dinner` | For a group: map → how many for dinner (wheel) → dinner time (dial), then questions about the table. Results are two-stop plans sized for the group. |
| **Near me** | `/near` | Allow location, type the bar you're standing in (it suggests as you type, uses our pin, no geocoder), or an address. Eight bars sorted by the walk, in the same swipe carousel, with "4 min walk" on each card. |
| Just say it | Home | Type "six of us in the West Village, want to dance, no line" and it becomes the same query. It knows every place by name: "Bar Primi" puts Bar Primi first (**You said**) with the night built around it; "we're at McSorleys, something quieter" becomes Near me from McSorley's; "like The Spaniard but for a first date" keeps The Spaniard as the anchor and adds what you asked for. **Streets, corners and landmarks are places too** (V9): "dance near Bleecker with live music", "first date by Washington Square", "around Delancey and Essex". Misspellings, missing apostrophes and dropped "The"s are fine. Keyword parser always; Claude when `ANTHROPIC_API_KEY` is set. |
| Search | `/search` | Under Dinner & drinks on the home page and on the YOU tab. Names first (typo-tolerant), then tags and neighborhoods ("rooftop williamsburg"). Every row opens the review. A miss says "Not on ROUND yet" and offers the recommend flow. |
| **Recommend a place** | `/recommend` | Anyone can send one: the name, where (map), twelve quick questions about the place (typed out, buttons), one line on the move there, optional name. Lands in the back-office inbox. Honeypot-protected, capped, nothing public. |
| **Rate this bar** | venue page | Not stars. Four taps: a verdict in words (Take me back tonight · I'd go back · It was fine · Never again), what the room was (up to three words; this is what the algorithm learns from), where it lands on **your ladder** (up to three "better than X?" questions against the places you've already rated), and one line for the group chat. Your ladder lives on YOU. A never-again is never picked for you again, and your ladder and your words go into Claude's prompt when it picks (via a small cookie; no account needed). |
| **ROUND's score** | cards + venue page | A number in the ring next to *ROUND says*, 0–100, how much we like it. Set in Studio; hidden until set. Under it, once three people have rated: "88% would go back · 24 ratings". |
| **Daytime (Studio)** | editor + add flow | Every place has **Good during the day** (a switch; it's the `daytime` attribute the engine and Claude read) and a one-line **day deal** ("$5 pitchers till 6") that shows with the hours. The add flow asks "Good during the day?" after the hours. Places that came from the research list are pre-marked from their tags (rooftops, backyards, beer gardens, sports bars). |
| **Add a place (Studio)** | `/admin/add` | The way in that isn't a form: one question at a time, typed out. Name → where → bar / bar with a kitchen / restaurant → what kind of food → three words for it (your own words count; Claude turns them into attributes on save) → **the quick ones, asked by Claude**: each next question comes from what you've already answered (yes to live music → sit and listen or stand and sing, not "loud?"), with a restaurant set for restaurants (reservations, noise, shared plates, price per head, late kitchen, date or group, wine or cocktails, bougie or chill), stopping around ten → hours (paste the website and Claude reads them, or presets, or day by day) → ROUND says → heads up → ROUND's score → have you been (verified) → photo → save. Everything lands in the same fields the full form edits (`/admin/new` is still there). On any venue page, when this browser is signed into Studio, a small bar offers one-tap **Verify** and **Edit**. |
| **Back office** | `/admin` | PIN-protected (`ROUND_ADMIN_PIN`). Add and edit places on your phone: tags, every attribute as No / Some / Yes, group and date fit, room, hours, Take, the catch, private notes, photo (upload yours, or **Find a photo** on Wikimedia Commons with the license and credit carried along), verified, and **What's hot right now** (on the shelf, order, and the story: the blog). **Recommendations** inbox at `/admin/suggestions`: Add as a place (the form opens pre-filled from their answers) or Not for us. Saves go live within a minute. See **SUPABASE.md**. |
| The card | results + venue page | Photo, then **ROUND says** (your words, with the score in the ring), the name with the verified mark, the keywords line (neighborhood · bar / bar with a kitchen / restaurant · what kind of food · tags · price), why it's here tonight, **tonight's hours** (tap for the week; a green dot when it's open now), one quiet heads-up, and GO / Want to go / Share. The venue page adds I've been and Rate this bar. Hours show only when they're set (Studio, or "fill in from the web"). |
| Results | `/results?…` | **Six cards you swipe through**: The pick · Also great · Easy in, then three more with a reason each (Late one, Cheap and good, Splurge, Big room, Classic, Sleeper). Each card has the photo, the Take, the catch, price, room, getting in, best time, and GO / Want to Go / Share. Date and Dinner modes return two-stop plans. **Claude picks the six (V9)** on every results page (Night out, Date, Dinner & drinks, Near me, Just say it): it reads the whole ROUND catalog (every take, catch, price, room, hours), your answers and your own words, and returns the six that fit with a one-line *why* on each card and a "We heard: …" line up top. The rules engine (`lib/engine.ts`) still runs first and is the answer when there's no key or the model is slow (about 9 seconds). While Claude thinks, the page types "Reading the room." **Verified places win ties**: the rules engine gives them an 8% edge and Claude is told that when a verified and an unverified place fit about equally, the verified one goes first, but never to pick a verified place that doesn't fit. Studio's dashboard shows **Did the pick land?** (a GO tap or a save within three hours of the results) so the picking can be tuned on evidence. |
| Venue page | `/v/[slug]` | ROUND's Take, The catch, best for / best time / price / room, I've been + rating. Server-rendered, indexable. **The verified mark** (the ROUND ring with a check) sits next to the name here and on every card, shelf entry, search row and share card, but only for places with **Verified** switched on in Studio (you've been, and it's right). Unverified pages say "Not yet verified by ROUND." Our opinion only counts with the check on it. |
| Plan link | `/p/[code]` | The share card. Encodes the whole plan in the URL (no database), renders a real Open Graph image for iMessage. |
| YOU | `/you` | Your nightlife map (MapLibre + OpenFreeMap), Want to Go, Been with ratings, taste line, and your account. |
| **Accounts** | sheet, anywhere | Phone number → six-digit text → first name + birthday (21+) → a few quick ones about you (see **About you**). Asked for the first time you save or rate something, always skippable. Saves, ratings and GO taps sync to the account; signing in on a new phone merges the two histories. Supabase Auth + Twilio Verify, see **SUPABASE.md §7**. |
| Taste quiz | `/quiz` | Ten iconic bars, swipe or tap: Pass / Want to go / Been / Loved it. Seeds the map and the taste profile. |
| **Friends** | `/friends` | Signed out, it's the pitch, typed out like the questions: *Put your number in. We'll connect you with your friends.* Then why: see which friends are here, see what bar they're at tonight, rank your spots, a drink on us at your favorite bar, and (soon) your friends' and your favorite people's picks. **Add my number** opens the sign-in sheet; **Maybe later** shows ROUND's regulars. Signed in (V8): **Out right now** (friends who tapped GO in the last 4 hours, and where), **Find your friends** (Allow contacts on iPhone Safari / Android Chrome: the phone hashes the numbers and only the hashes are compared; or search by name; or Invite a friend), requests in and out, your friends list, and **Who sees you**: public (anyone can add you) or private (people request first), and whether friends can see which bar you're at. Nobody's number is ever shown. |
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
| `ANTHROPIC_API_KEY` | strongly recommended | Turns on Claude: it **picks the six** on every results page (with the whole catalog in its head), reads **Just say it** (streets, landmarks, typos, names), and drafts the Take in Studio. Everything still works without it, on the rules engine. |
| `ROUND_PICK_MODEL` | no | The model that picks results. Defaults to `claude-sonnet-5`; falls back to `claude-haiku-4-5-20251001` automatically if that name isn't available on your key. |
| `ROUND_TEXT_MODEL` | no | The model that reads "Just say it". Defaults to `claude-sonnet-5`, same fallback. |
| `ROUND_PICK_TIMEOUT_MS` | no | How long to wait for Claude before the rules engine answers. Defaults to `9000`. |
| `ROUND_PICK_MEMO_MS` | no | How long an identical pick is reused before Claude is asked again. Defaults to 15 minutes. |
| `ROUND_GEOCODER_URL` | no | Address lookup for Studio. Defaults to OpenStreetMap's Nominatim. |
| `ROUND_AI_PER_MINUTE`, `ROUND_AI_GLOBAL_PER_MINUTE` | no | The brake on model calls: per phone (by IP, default 10 a minute) and for the whole server (default 300 a minute). Over the limit the app still answers, on the rules engine. Also set a monthly spend limit in the Anthropic console. |
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
  you/, quiz/               Personal map, taste quiz
  friends/                  Friends tab
  best/[neighborhood]/[occasion]/   SEO pages
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

## The venue data (V6: 229 places)

Sixty-six hand-written originals plus 163 researched places, one JSON file per neighborhood in `lib/seed/`. The research pass read public sources (guides, venue sites, reservation pages, local news) for facts, then wrote ROUND's own Take, catch, traits and fit for each; nothing is copied, every entry lists its sources in `sources` and a factual summary in `notes` (back office only). Coordinates are estimated from the street address (usually within ~50 m); tap **Find** in the back office to pin one exactly. Everything is `verified: false` until someone from ROUND has been. In the back office, **Update from ROUND's list** brings the database up to date with this list without touching verified places, photos, the shelf or stories.

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

Near me: with no wants, `near×0.45 + time×0.15 + score×0.20 + verified 0.15 + easyIn×0.05` (so a verified place wins within about five minutes' walk of an unverified one, and ROUND's score settles the rest); with wants, `near×0.40 + time×0.20 + prefs×0.25 + score×0.10 + easyIn×0.05` times the verified boost. The spot they're standing at is excluded.

Tune the weights there; the best-of pages and results update together.

## ROUND Studio (the private side)

`/admin`, PIN-protected, laptop-first with a phone layout. **Dashboard**: places, verified, on the shelf; GO taps, results shown, searches and accounts for the last 7 days; most tapped, most opened, most saved, where people ask about, what people search (and what they searched that isn't on ROUND), and the latest "just say it" phrases with what we understood. **Places**: every place in a sortable, filterable table; verified and shelf toggles inline; select several and mark verified or put on the shelf in one go. **Stories**: the blog. Pick a place, write in a big editor with a live preview of how it reads, set the shelf order, save. **Recommendations**: the inbox. **People**: accounts (phones masked), what they've loved and saved. **Activity**: everything, in order, filterable by kind. The editor for a place now starts from your notes: paste what you'd text a friend and Claude fills the whole form (traits, price, hours, the Take), you fix and save.

All of it lives in your Supabase project: `venues`, `suggestions`, `events`, `go_taps`, `saves`, `profiles`. Nothing on the private side is readable from the app; the secret key only exists on the server.

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
