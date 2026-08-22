-- Regions: each preaching location gets its own board. People and teacher
-- profiles belong to a region; stages stay shared across all regions.
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.regions enable row level security;

create unique index if not exists regions_name_lower_idx
  on public.regions (lower(name));

alter table public.profiles
  add column if not exists region_id uuid references public.regions (id) on delete set null;

alter table public.people
  add column if not exists region_id uuid references public.regions (id) on delete set null;

create index if not exists profiles_region_id_idx on public.profiles (region_id);
create index if not exists people_region_id_idx on public.people (region_id);

-- A teacher name only has to be unique inside its own region, so the global
-- unique index gives way to a region-scoped one.
drop index if exists public.profiles_name_lower_idx;

create unique index if not exists profiles_region_name_lower_idx
  on public.profiles (region_id, lower(name));
