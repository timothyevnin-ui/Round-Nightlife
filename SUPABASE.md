# Connecting the back office (Supabase)

The back office at `/admin` needs a database. Supabase's free plan is plenty. About ten minutes, no code.

## 1. Create the project

1. Go to **supabase.com** → Sign in with GitHub → **New project**.
2. Name it `round`, pick a strong database password (you won't need it again, but save it), region **East US (North Virginia)**. Create.
3. Wait for it to finish provisioning (a minute or two).

## 2. Create the table

1. In the left sidebar, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy everything, paste it in, click **Run**.
3. You should see "Success. No rows returned."

## 3. Copy the keys

Left sidebar → **Project Settings** (gear) → **API** (or **API Keys**).

You need three values:

| Supabase calls it | Put it in Vercel as |
| --- | --- |
| **Project URL** (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon** public key (or **publishable** key, `sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** secret key (or **secret** key, `sb_secret_…`) | `SUPABASE_SERVICE_ROLE_KEY` |

The service key can write to your database. It only ever lives on the server; never paste it anywhere public.

## 4. Add them to Vercel, plus your PIN

Vercel → your project → **Settings → Environment Variables**. Add:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from step 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 3 |
| `ROUND_ADMIN_PIN` | any PIN you'll remember (this is the back-office password) |
| `NEXT_PUBLIC_SITE_URL` | `https://round-nightlife.vercel.app` (if not already set) |
| `ANTHROPIC_API_KEY` | optional: turns on "Draft the Take from my notes", screenshot reading, and smarter "just say it" |

Then **Deployments → ⋯ → Redeploy**.

## 5. Open the back office

Go to `https://round-nightlife.vercel.app/admin`, enter your PIN, tap **Import 68 seed** once. From then on, every place you add or edit is live in the app within a minute.

## What if I skip this?

Everything still works on the built-in seed venues. The back office opens (with your PIN) but is read-only until the database is connected.
