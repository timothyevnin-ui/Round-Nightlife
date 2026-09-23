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
drop policy if exists "profiles: own delete" on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);
create policy "profiles: own delete" on public.profiles for delete using (auth.uid() = id);

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

-- ─────────────────────────────────────────────────────────────────────────
-- Recommendations from anyone ("Know a spot we don't?"). Written by the
-- server with the secret key, read only in the back office. No public policy
-- on purpose: nobody can read these from the app.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.suggestions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null default 'bar' check (kind in ('bar', 'restaurant')),
  neighborhood  text,
  address       text,
  why           text,
  answers       jsonb not null default '{}'::jsonb,
  from_name     text,
  from_contact  text,
  user_id       uuid references auth.users (id) on delete set null,
  status        text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  venue_slug    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists suggestions_status_idx on public.suggestions (status, created_at desc);

drop trigger if exists suggestions_touch on public.suggestions;
create trigger suggestions_touch before update on public.suggestions
  for each row execute function public.touch_updated_at();

alter table public.suggestions enable row level security;

-- Photo credit for pictures that came from Wikimedia Commons (or anywhere
-- that asks to be named). Shown small under the photo.
alter table public.venues add column if not exists photo_credit text;

-- ─────────────────────────────────────────────────────────────────────────
-- What people do in the app (V7): what they typed into "just say it", what
-- they searched, which results they were shown, which pages they opened.
-- Written by the server only; read only in the Studio. No public policy.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.events (
  id       bigint generated always as identity primary key,
  kind     text not null check (kind in ('sayit', 'search', 'results', 'view', 'save', 'near', 'go')),
  slug     text,
  q        text,
  data     jsonb not null default '{}'::jsonb,
  user_id  uuid references auth.users (id) on delete set null,
  at       timestamptz not null default now()
);

create index if not exists events_at_idx on public.events (at desc);
create index if not exists events_kind_idx on public.events (kind, at desc);
create index if not exists events_slug_idx on public.events (slug) where slug is not null;

alter table public.events enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Friends (V8). Your contacts who have ROUND become your friends; friends can
-- see which bar you're at (if you let them). Public accounts are followed
-- instantly, private ones get a request.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists phone_hash     text;
alter table public.profiles add column if not exists is_public      boolean not null default true;
alter table public.profiles add column if not exists share_location boolean not null default true;
create index if not exists profiles_phone_hash_idx on public.profiles (phone_hash);

-- The phone never leaves the phone during contact matching: the app sends
-- SHA-256 of each number and we compare against this column. Kept in step
-- with `phone` by a trigger, so nothing else has to remember.
create or replace function public.profiles_hash_phone() returns trigger language plpgsql as $$
begin
  -- Same form the app hashes: "+" followed by digits only, whatever was stored.
  new.phone_hash = case when new.phone is null or regexp_replace(new.phone, '[^0-9]', '', 'g') = '' then null
                        else encode(digest('+' || regexp_replace(new.phone, '[^0-9]', '', 'g'), 'sha256'), 'hex') end;
  return new;
end $$;
drop trigger if exists profiles_hash on public.profiles;
create trigger profiles_hash before insert or update of phone on public.profiles
  for each row execute function public.profiles_hash_phone();
update public.profiles set phone = phone where phone_hash is null and phone is not null;

-- What other people may see of a profile: never the phone.
create or replace view public.people with (security_invoker = false) as
  select id, name, is_public from public.profiles;
grant select on public.people to authenticated;

-- One row per direction. 'following' = accepted; 'pending' = asked, not yet accepted.
create table if not exists public.friends (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'following' check (status in ('following', 'pending')),
  at         timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friends_friend_idx on public.friends (friend_id, status);

alter table public.friends enable row level security;
drop policy if exists "friends: see own edges"      on public.friends;
drop policy if exists "friends: add own"            on public.friends;
drop policy if exists "friends: accept for me"      on public.friends;
drop policy if exists "friends: remove own"         on public.friends;
create policy "friends: see own edges" on public.friends for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friends: add own"       on public.friends for insert with check (auth.uid() = user_id);
create policy "friends: accept for me" on public.friends for update using (auth.uid() = friend_id or auth.uid() = user_id);
create policy "friends: remove own"    on public.friends for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- Where you are: set when you tap GO, visible to friends for a few hours.
create table if not exists public.checkins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  slug      text not null,
  at        timestamptz not null default now()
);

alter table public.checkins enable row level security;
drop policy if exists "checkins: own write"        on public.checkins;
drop policy if exists "checkins: friends can see"  on public.checkins;
create policy "checkins: own write" on public.checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "checkins: friends can see" on public.checkins for select using (
  auth.uid() = user_id
  or (
    exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = checkins.user_id and f.status = 'following')
    and exists (select 1 from public.profiles p where p.id = checkins.user_id and p.share_location)
  )
);

-- Contact matching. The app hashes the numbers on the phone; this returns the
-- people on ROUND among them (never the other way round).
create or replace function public.match_contacts(hashes text[])
returns table (id uuid, name text, is_public boolean)
language sql security definer set search_path = public as $$
  select p.id, p.name, p.is_public
  from public.profiles p
  where p.phone_hash = any(hashes) and p.id <> auth.uid()
  limit 500
$$;
revoke all on function public.match_contacts(text[]) from public;
grant execute on function public.match_contacts(text[]) to authenticated;

-- Becoming friends. Public people are friends at once (both directions);
-- private people get a request they accept. Runs as the definer so the
-- second direction can be written; every function checks who's asking.
create or replace function public.befriend(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pub boolean;
begin
  if me is null or target is null or target = me then raise exception 'not allowed'; end if;
  select is_public into pub from public.profiles where id = target;
  if pub is null then raise exception 'no such person'; end if;
  if pub then
    insert into public.friends (user_id, friend_id, status) values (me, target, 'following')
      on conflict (user_id, friend_id) do update set status = 'following';
    insert into public.friends (user_id, friend_id, status) values (target, me, 'following')
      on conflict (user_id, friend_id) do update set status = 'following';
    return 'following';
  else
    insert into public.friends (user_id, friend_id, status) values (me, target, 'pending')
      on conflict (user_id, friend_id) do nothing;
    return 'pending';
  end if;
end $$;

create or replace function public.accept_friend(requester uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not allowed'; end if;
  update public.friends set status = 'following' where user_id = requester and friend_id = me and status = 'pending';
  if not found then raise exception 'no request'; end if;
  insert into public.friends (user_id, friend_id, status) values (me, requester, 'following')
    on conflict (user_id, friend_id) do update set status = 'following';
end $$;

create or replace function public.unfriend(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not allowed'; end if;
  delete from public.friends where (user_id = me and friend_id = target) or (user_id = target and friend_id = me);
end $$;

revoke all on function public.befriend(uuid) from public;
revoke all on function public.accept_friend(uuid) from public;
revoke all on function public.unfriend(uuid) from public;
grant execute on function public.befriend(uuid) to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;
grant execute on function public.unfriend(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- V11. Hours, food, and a rating that's more than stars.
-- ─────────────────────────────────────────────────────────────────────────

-- Posted hours (7 entries, Sunday first, {open, close} or null), whether a
-- bar has a real food menu, and what kind of food.
alter table public.venues add column if not exists hours    jsonb;
alter table public.venues add column if not exists bar_food boolean not null default false;
alter table public.venues add column if not exists cuisine  text;
-- ROUND's score: how much we like it, 0–100 (think Tomatometer, but it's ours).
alter table public.venues add column if not exists score    integer check (score between 0 and 100);
-- Daytime (V12): the day deal in one line. "Good in daylight" itself lives in attrs.
alter table public.venues add column if not exists day_deal text;

-- "Rate this bar": a verdict in words, what the room was (feeds the
-- algorithm), where it sits on the person's own ladder, and one line.
alter table public.saves add column if not exists verdict text check (verdict in ('again', 'back', 'fine', 'never'));
alter table public.saves add column if not exists tags    text[];
alter table public.saves add column if not exists rank    integer;
alter table public.saves add column if not exists note    text;

-- What people say a place is: counts per tag, readable by anyone (no user ids).
create or replace view public.venue_tags with (security_invoker = false) as
  select slug, unnest(tags) as tag, count(*)::int as n
  from public.saves
  where state = 'been' and tags is not null
  group by slug, tag;
grant select on public.venue_tags to anon, authenticated;

-- The crowd: how many rated a place, and how many of them would go back.
create or replace view public.venue_scores with (security_invoker = false) as
  select slug,
         count(*)::int as n,
         sum(case when verdict in ('again', 'back') then 1 else 0 end)::int as back,
         sum(case when verdict = 'again' then 1 else 0 end)::int as again
  from public.saves
  where state = 'been' and verdict is not null
  group by slug;
grant select on public.venue_scores to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- V14. About you: a photo, where you're from, your favorite bar and
-- restaurant, and a few fun ones. All optional, all skippable.
alter table public.profiles add column if not exists hometown       text;
alter table public.profiles add column if not exists fav_bar        text;
alter table public.profiles add column if not exists fav_bar_slug   text;
alter table public.profiles add column if not exists fav_restaurant text;
alter table public.profiles add column if not exists fun            jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists avatar_url     text;

-- Friends can see a face and a hometown (never a phone, never a birthday).
create or replace view public.people with (security_invoker = false) as
  select id, name, is_public, avatar_url, hometown from public.profiles;
grant select on public.people to authenticated;

-- Profile photos: a public bucket where each person can only write their own folder.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  drop policy if exists "avatars are public" on storage.objects;
  create policy "avatars are public" on storage.objects for select using (bucket_id = 'avatars');
  drop policy if exists "own avatar: insert" on storage.objects;
  create policy "own avatar: insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists "own avatar: update" on storage.objects;
  create policy "own avatar: update" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists "own avatar: delete" on storage.objects;
  create policy "own avatar: delete" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
exception when others then
  raise notice 'avatars bucket step skipped (%): create a public bucket named avatars in Storage', sqlerrm;
end $$;

-- Later phases (plans, census) add their tables here.
