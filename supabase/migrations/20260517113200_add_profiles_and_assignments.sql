create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create unique index if not exists profiles_name_lower_idx
  on public.profiles (lower(name));

alter table public.profiles
  drop constraint if exists profiles_avatar_url_size_chk;

alter table public.profiles
  add constraint profiles_avatar_url_size_chk
  check (
    avatar_url is null
    or (
      char_length(avatar_url) <= 100000
      and avatar_url ~ '^data:image/(png|jpeg|jpg|webp);base64,'
    )
  );

insert into public.profiles (name)
select distinct trim(teacher)
from public.people
where teacher is not null
  and char_length(trim(teacher)) between 1 and 30
on conflict do nothing;

insert into public.profiles (name)
values ('Team')
on conflict do nothing;

alter table public.people
  add column if not exists assigned_profile_ids uuid[] not null default '{}'::uuid[];

with default_profile as (
  select id
  from public.profiles
  order by case when lower(name) = 'team' then 0 else 1 end, created_at, id
  limit 1
),
teacher_profiles as (
  select
    people.id as person_id,
    profiles.id as profile_id
  from public.people
  join public.profiles
    on lower(profiles.name) = lower(trim(people.teacher))
)
update public.people
set assigned_profile_ids = array[
  coalesce(
    (select profile_id from teacher_profiles where teacher_profiles.person_id = people.id),
    (select id from default_profile)
  )
]
where cardinality(assigned_profile_ids) = 0;

alter table public.people
  drop constraint if exists people_assigned_profile_ids_size_chk;

alter table public.people
  add constraint people_assigned_profile_ids_size_chk
  check (
    archived_at is not null
    or cardinality(assigned_profile_ids) between 1 and 3
  );

create index if not exists people_assigned_profile_ids_idx
  on public.people using gin (assigned_profile_ids);

alter table public.person_events
  add column if not exists actor_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists person_events_actor_profile_idx
  on public.person_events (actor_profile_id, created_at desc);
