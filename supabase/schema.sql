-- ROUND · venues table + public photo bucket.
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run twice.

create extension if not exists pgcrypto;

create table if not exists public.venues (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  kind          text not null default 'bar' check (kind in ('bar', 'restaurant')),
  neighborhood  text not null,
  address       text not null default '',
  lat           double precision,
  lng           double precision,
  take          text not null default '',
  the_catch     text,
  tags          text[] not null default '{}',
  attrs         jsonb not null default '{}'::jsonb,
  group_fit     jsonb not null default '{"two":0.7,"small":0.7,"mid":0.5,"big":0.3}'::jsonb,
  date_fit      jsonb not null default '{"first":0.5,"early":0.5,"longterm":0.5}'::jsonb,
  price         integer not null default 2 check (price between 1 and 4),
  capacity      text not null default 'medium' check (capacity in ('tiny','small','medium','large')),
  best_windows  jsonb not null default '[]'::jsonb,
  easy_in       double precision not null default 0.5,
  photo         jsonb,
  photo_url     text,
  friends_been  integer default 0,
  perk          text,
  group_booking jsonb,
  verified      boolean not null default false,
  notes         text,
  sources       text[] default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Added later: the "What's hot right now" shelf and the long-form write-up.
alter table public.venues add column if not exists hot      boolean not null default false;
alter table public.venues add column if not exists hot_rank integer;
alter table public.venues add column if not exists story    text;

create index if not exists venues_neighborhood_idx on public.venues (neighborhood);
create index if not exists venues_hot_idx on public.venues (hot) where hot;
create index if not exists venues_verified_idx on public.venues (verified);

-- Keep updated_at honest.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists venues_touch on public.venues;
create trigger venues_touch before update on public.venues
  for each row execute function public.touch_updated_at();

-- Anyone can read venues (the app is public); only the service role writes.
alter table public.venues enable row level security;
drop policy if exists "venues are public" on public.venues;
create policy "venues are public" on public.venues for select using (true);

-- Public photo bucket for venue photography. Wrapped so the venues table above
-- is never blocked by a storage permission quirk; if this part is skipped,
-- create a public bucket named "photos" in Storage by hand.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

  drop policy if exists "photos are public" on storage.objects;
  create policy "photos are public" on storage.objects for select using (bucket_id = 'photos');
exception when others then
  raise notice 'storage step skipped (%): create a public bucket named photos in Storage', sqlerrm;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Accounts (phone sign-in). Supabase Auth owns auth.users; these are ours.
-- ─────────────────────────────────────────────────────────────────────────

-- One row per person. Created the first time they sign in.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  birthday    date,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own insert" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Want to go / Been / rating, one row per person per place.
create table if not exists public.saves (
  user_id     uuid not null references auth.users (id) on delete cascade,
  slug        text not null,
  state       text not null check (state in ('want', 'been')),
  rating      text check (rating in ('loved', 'good', 'meh')),
  source      text,
  at          timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, slug)
);

create index if not exists saves_slug_idx on public.saves (slug);

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves
  for each row execute function public.touch_updated_at();

alter table public.saves enable row level security;
drop policy if exists "saves: own all" on public.saves;
create policy "saves: own all" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every GO tap. The receipt for partner bars. Anonymous taps are allowed
-- (user_id null); nobody can read them except the service role.
create table if not exists public.go_taps (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  slug        text not null,
  at          timestamptz not null default now()
);

create index if not exists go_taps_slug_idx on public.go_taps (slug, at desc);

alter table public.go_taps enable row level security;
drop policy if exists "go_taps: anyone can log" on public.go_taps;
create policy "go_taps: anyone can log" on public.go_taps for insert with check (user_id is null or auth.uid() = user_id);

-- Later phases (friends, plans, census) add their tables here.
