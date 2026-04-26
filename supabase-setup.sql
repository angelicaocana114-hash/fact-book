create table if not exists public.factbook_profiles (
  id text primary key,
  display_name text not null,
  password_hint text,
  avatar_data_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.factbook_comments (
  id text primary key,
  post_id text not null,
  profile_id text not null references public.factbook_profiles (id) on delete cascade,
  display_name text not null,
  avatar_data_url text not null,
  body_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.factbook_reactions (
  id text primary key,
  post_id text not null,
  profile_id text not null references public.factbook_profiles (id) on delete cascade,
  reaction_name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists factbook_reactions_post_profile_idx
  on public.factbook_reactions (post_id, profile_id);

alter table public.factbook_profiles enable row level security;
alter table public.factbook_comments enable row level security;
alter table public.factbook_reactions enable row level security;

drop policy if exists "factbook profiles readable" on public.factbook_profiles;
create policy "factbook profiles readable"
on public.factbook_profiles
for select
to anon
using (true);

drop policy if exists "factbook profiles insertable" on public.factbook_profiles;
create policy "factbook profiles insertable"
on public.factbook_profiles
for insert
to anon
with check (true);

drop policy if exists "factbook profiles updatable" on public.factbook_profiles;
create policy "factbook profiles updatable"
on public.factbook_profiles
for update
to anon
using (true)
with check (true);

drop policy if exists "factbook comments readable" on public.factbook_comments;
create policy "factbook comments readable"
on public.factbook_comments
for select
to anon
using (true);

drop policy if exists "factbook comments insertable" on public.factbook_comments;
create policy "factbook comments insertable"
on public.factbook_comments
for insert
to anon
with check (true);

drop policy if exists "factbook reactions readable" on public.factbook_reactions;
create policy "factbook reactions readable"
on public.factbook_reactions
for select
to anon
using (true);

drop policy if exists "factbook reactions insertable" on public.factbook_reactions;
create policy "factbook reactions insertable"
on public.factbook_reactions
for insert
to anon
with check (true);

drop policy if exists "factbook reactions updatable" on public.factbook_reactions;
create policy "factbook reactions updatable"
on public.factbook_reactions
for update
to anon
using (true)
with check (true);
