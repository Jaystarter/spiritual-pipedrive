create type public.study_stage as enum (
  'hunting',
  'first_bible_study',
  'third_bible_study',
  'seventh_bible_study',
  'ready_for_baptism',
  'baptized'
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  stage public.study_stage not null default 'hunting',
  phone text,
  teacher text,
  notes text,
  sort_order integer not null default 0,
  baptized_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_active_stage_sort_idx
  on public.people (stage, sort_order, created_at)
  where archived_at is null;

create index people_baptized_at_idx
  on public.people (baptized_at)
  where archived_at is null and stage = 'baptized';

create or replace function public.set_people_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger people_set_updated_at
before update on public.people
for each row
execute function public.set_people_updated_at();

alter table public.people enable row level security;
