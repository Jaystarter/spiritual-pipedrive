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

-- The 20260517 migration seeds a default 'Team' profile. On a fresh database
-- it would be the only orphan and would conjure a phantom "Original Board"
-- region below, so drop it when it is provably untouched: default avatar, no
-- contacts, no events, no studies, no push subscriptions. A Team profile that
-- was ever actually used survives and is swept with everything else.
delete from public.profiles p
  where p.region_id is null
    and lower(p.name) = 'team'
    and p.avatar_url is null
    and not exists (
      select 1 from public.people pe
        where p.id = any(pe.assigned_profile_ids)
          or pe.created_by_profile_id = p.id
    )
    and not exists (
      select 1 from public.person_events ev
        where ev.actor_profile_id = p.id
          or ev.notification_profile_id = p.id
    )
    and not exists (
      select 1 from public.person_studies st where st.actor_profile_id = p.id
    )
    and not exists (
      select 1 from public.push_subscriptions ps where ps.profile_id = p.id
    );

-- If this migration lands on a database that already has people or profiles
-- (a pre-region deployment), gather the orphans into an "Original Board"
-- region so nothing becomes unreachable. On a fresh database this is a no-op.
do $$
declare
  legacy_region uuid;
begin
  if exists (select 1 from public.people where region_id is null)
     or exists (select 1 from public.profiles where region_id is null) then
    select id into legacy_region
      from public.regions
      where lower(name) = lower('Original Board');

    if legacy_region is null then
      insert into public.regions (name)
        values ('Original Board')
        returning id into legacy_region;
    end if;

    update public.people set region_id = legacy_region where region_id is null;
    update public.profiles set region_id = legacy_region where region_id is null;
  end if;
end $$;
