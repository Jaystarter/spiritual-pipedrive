alter table public.people
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_follow_up_at timestamptz;

create table if not exists public.person_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  event_type text not null check (
    event_type in ('created', 'stage_moved', 'details_updated', 'note_added', 'archived')
  ),
  title text not null check (char_length(trim(title)) > 0),
  body text,
  from_stage public.study_stage,
  to_stage public.study_stage,
  created_at timestamptz not null default now()
);

create index if not exists person_events_person_created_idx
  on public.person_events (person_id, created_at desc);

alter table public.person_events enable row level security;
