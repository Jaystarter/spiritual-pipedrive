create table if not exists public.person_studies (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  study_number integer not null check (study_number between 1 and 30),
  studied_at date not null,
  notes text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, study_number)
);

alter table public.person_studies enable row level security;

create index if not exists person_studies_person_number_idx
  on public.person_studies (person_id, study_number);

create index if not exists person_studies_actor_created_idx
  on public.person_studies (actor_profile_id, created_at desc);

create or replace function public.set_person_studies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists person_studies_set_updated_at on public.person_studies;

create trigger person_studies_set_updated_at
before update on public.person_studies
for each row
execute function public.set_person_studies_updated_at();

alter table public.person_events
  drop constraint if exists person_events_event_type_check;

alter table public.person_events
  add constraint person_events_event_type_check
  check (
    event_type in (
      'created',
      'stage_moved',
      'details_updated',
      'note_added',
      'study_logged',
      'archived'
    )
  );
