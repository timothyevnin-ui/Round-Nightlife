# Connecting the back office (Supabase) + turning on Claude

The back office at `/admin` needs a database. Supabase's free plan is plenty. About ten minutes, no code. Then two minutes for the Anthropic key.

## 1. Create the Supabase project

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**. Organization: the default one. Name: `round`. Database password: hit **Generate a password** and save it somewhere (you won't need it day to day). Region: **East US (North Virginia)**. Plan: Free. **Create new project**.
3. Wait for it to finish setting up (a minute or two; the dashboard says when it's ready).

## 2. Create the table

1. Left sidebar → **SQL Editor** → **New query** (or the **+**).
2. Open `supabase/schema.sql` from this repo, select all, copy, paste it in, click **Run** (bottom right, or ⌘/Ctrl-Enter).
3. You should see **Success. No rows returned.** If it prints a "notice" about storage, that's fine (see the note at the bottom).

## 3. Copy the three values

Left sidebar → **Project Settings** (gear, near the bottom) → **API Keys**.

| What you're looking for | Where | Goes into Vercel as |
| --- | --- | --- |
| **Project URL** (`https://xxxxxxxx.supabase.co`) | Project Settings → **Data API** (or the top of the API Keys page) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`) | API Keys → **Publishable and secret API keys** tab | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (`sb_secret_…`) | Same tab → **Secret keys** → **Create new secret key** → name it `vercel` → **Create**. Copy it right away. | `SUPABASE_SECRET_KEY` |

The secret key can write to your database. It only ever lives on the server (Vercel), never in a text message, screenshot, or anywhere public. If you ever think it leaked, delete it in that same tab and make a new one.

(If your project happens to show a **Legacy API keys** tab with `anon` and `service_role` instead, those work too: put them in the same two Vercel variables.)

## 4. Get the Anthropic key

1. Go to **console.anthropic.com** → sign in (email code or Google).
2. **Billing** → add a card and buy a small amount of prepaid credit ($5–$10 lasts a long time: the app uses Claude Haiku, which costs a fraction of a cent per Take or question).
3. **API Keys** → **Create Key** → name it `round-vercel` → **Create**. Copy it right away; it's shown once.

This turns on **Draft the Take from my notes** in the back office and the smarter version of **Just say it**. Without it, both fall back gracefully.

## 5. Add everything to Vercel

Vercel → your `round-nightlife` project → **Settings** → **Environment Variables**. For each one: paste the **Key**, paste the **Value**, leave all environments checked, **Save**.

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` from step 3 |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` from step 3 |
| `ANTHROPIC_API_KEY` | `sk-ant-…` from step 4 |
| `ROUND_ADMIN_PIN` | any PIN you'll remember (the back-office password), if not already set |
| `NEXT_PUBLIC_SITE_URL` | `https://round-nightlife.vercel.app`, if not already set |

Then **Deployments** tab → **⋯** on the top deployment → **Redeploy** → confirm. Environment variables only take effect on a new deployment, so this step isn't optional.

## 6. Open the back office

Go to `https://round-nightlife.vercel.app/admin`, enter your PIN. The banner at the top should be gone. Tap **Import 68 seed** once; the list reloads showing "68 in the database". From then on, every place you add or edit is live in the app within a minute.

Quick test: open any place, change one word of the Take, Save, then open its public page (the link at the top of the editor). Then try **Draft the Take** on a place with a couple of notes.

## 6b. After any code update: run the SQL again

Whenever a new version of the code adds fields, paste the current `supabase/schema.sql` into the SQL Editor and **Run** it again. It only adds what's missing; nothing is lost.

What each update needed:

- **V4** added the "What's hot" shelf and the story (`hot`, `hot_rank`, `story`).
- **V5** adds the **recommendations inbox** (a new `suggestions` table: nobody can read it from the app, only the back office) and a **photo credit** column (`photo_credit`, for pictures that come from Wikimedia Commons).
- **V7** adds the **activity log** (an `events` table: what people typed into "just say it", what they searched, which results they saw, which pages they opened). The Studio dashboard and Activity page read from it. Until you run the SQL, the app works the same and the Studio says the table is missing.
- **V12** adds the **day deal** column (`day_deal`) on places. "Good in daylight" lives inside the attributes, so it needs nothing.
- **V11** adds **hours, food and ROUND's score** on places (`hours`, `bar_food`, `cuisine`, `score`), the new **Rate this bar** columns on saves (`verdict`, `tags`, `rank`, `note`), and two views anyone can read that carry no user ids: `venue_tags` (what people say a place is) and `venue_scores` (how many rated it and how many would go back). Until you run the SQL, ratings still save the old way (Loved / Good / Meh) and the new fields stay hidden.
- **V8** adds **friends**: three columns on `profiles` (`phone_hash`, `is_public`, `share_location`), a `people` view (name and public/private only, never the phone), a `friends` table, a `checkins` table (set when someone taps GO, visible to friends for four hours if they allow it), and four functions (`match_contacts`, `befriend`, `accept_friend`, `unfriend`). Contact matching compares SHA-256 hashes of phone numbers; the phone book never leaves the phone. Until you run the SQL, the Friends page says "Friends aren't switched on in the database yet."

Saving a place still works if you forget: the server notices a column the database doesn't have yet, saves without it, and logs a warning. But the inbox at `/admin/suggestions` and "Know a spot we don't?" on the home page need the table, so run the SQL once after uploading V5.

## 7. Phone sign-in (Twilio, about 10 minutes)

Accounts let people keep their Want-to-go / Been / ratings across phones. Supabase handles the accounts; Twilio sends the six-digit text. Nothing in ROUND requires an account, so this can wait, but it's cheap and worth doing early.

**a. Run the SQL again.** SQL Editor → paste the current `supabase/schema.sql` → **Run**. It's safe to re-run; this time it adds the `profiles`, `saves` and `go_taps` tables.

**b. Twilio.**
1. **twilio.com** → sign up (email + phone). Skip the questionnaire or answer "Verify users / OTP".
2. **Upgrade** the account (top banner or **Billing**): add a card and $20 of credit. Trial accounts can only text numbers you've pre-approved, which is no good for real users. Each login costs about five cents.
3. Left sidebar → **Explore Products** → **Verify** → **Services** → **Create new**. Friendly name `ROUND` (this is what the text says: "Your ROUND verification code is …"). Code length 6. Enable **SMS**. Create.
4. Copy the **Service SID** (starts `VA…`) from the service page.
5. Go to the **Account Dashboard** (Twilio logo, top left) and copy the **Account SID** (`AC…`) and **Auth Token** (click to reveal).
6. Recommended, two clicks: Verify → **Settings** → **Geo permissions**: leave only United States (and Canada if you like) enabled. This blocks the fraud pattern where bots request thousands of codes to overseas numbers. Twilio's **Fraud Guard** should be on by default; leave it on.

**c. Supabase.** Left sidebar → **Authentication** → **Sign In / Providers** → **Phone**.
- **Enable Sign in with Phone**: on.
- **SMS provider**: Twilio Verify.
- Paste the **Account SID**, **Auth Token** and **Verify Service SID**.
- **Save**.
- Optional while testing: the **Test phone numbers and OTPs** box lets you set a fake number and fixed code (e.g. `12125550100=123456`) that never sends a text.

**d. Nothing to add in Vercel.** The app uses the URL and publishable key it already has. Redeploy once after uploading the new code.

**e. Try it.** Open any place, tap **Want to go**: the sheet asks for your number. Code, first name, birthday, done. The YOU tab shows your name; sign out and back in on another phone and your places are there.

## 8. About you (V14): profile photos

Run the current `supabase/schema.sql` again (safe to re-run). It adds the about-you columns to `profiles`, widens the `people` view (friends see a photo and a hometown), and creates a public **avatars** bucket where each person can only write their own folder. If the bucket step is skipped (rare storage permission quirk; the SQL says so in its notices), create it by hand: **Storage** → **New bucket** → name `avatars` → **Public bucket** on → Save, then re-run the SQL for the policies.

## If something's off

- **Banner says "Read-only"** → the URL or publishable key isn't reaching Vercel. Check the spelling of the two `NEXT_PUBLIC_…` keys and that you redeployed after adding them.
- **Banner says "Almost"** → the secret key is missing or mistyped.
- **Save fails with "Invalid JWT"** → you're on an old copy of `lib/db.ts`; upload the current one.
- **Photo upload fails** → in Supabase, left sidebar → **Storage** → make sure there's a bucket named `photos` marked **Public**. If not, **New bucket** → name `photos` → toggle **Public bucket** on → Save.
- **Draft the Take does nothing** → the Anthropic key is missing, or the console has no prepaid credit.
- **"Couldn't send the text"** → Phone provider isn't enabled in Supabase, a Twilio SID/token is mistyped, or the Twilio account is still on trial. Supabase → Logs → Auth shows the exact reason.
- **Code arrives but "didn't match"** → codes expire after 60 seconds; tap resend.
- **"To send messages … you must have an approved Primary Compliance Profile" (Twilio 21608)** → Twilio only texts numbers you've verified until your Primary Compliance Profile is approved: Trust Hub → Profiles → Primary → create (Individual unless you have an EIN). Until it's approved, add testers under Phone Numbers → Verified Caller IDs.
- **Photo won't upload** → the `avatars` bucket is missing (§8).

## What if I skip this?

Everything still works on the built-in seed venues. The back office opens (with your PIN) but is read-only until the database is connected.
