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

create index if not exists venues_neighborhood_idx on public.venues (neighborhood);
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

-- Public photo bucket for venue photography.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos are public" on storage.objects;
create policy "photos are public" on storage.objects for select using (bucket_id = 'photos');

-- Later phases (accounts, saves, ratings, plans) add their tables here.
