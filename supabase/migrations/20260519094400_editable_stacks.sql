create table if not exists public.stages (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  label text not null check (char_length(trim(label)) between 1 and 48),
  short_label text not null check (char_length(trim(short_label)) between 1 and 24),
  description text not null default '' check (char_length(description) <= 140),
  tone text not null default 'sky' check (
    tone in ('amber', 'sky', 'indigo', 'violet', 'emerald', 'green')
  ),
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.stages (
  id,
  label,
  short_label,
  description,
  tone,
  sort_order,
  is_system
)
values
  (
    'hunting',
    'Sowing Seeds',
    'Seeds',
    'People being prayed for, contacted, or invited.',
    'amber',
    1000,
    true
  ),
  (
    'first_bible_study',
    'First Bible Study',
    '1st Study',
    'The first study is scheduled or recently completed.',
    'sky',
    2000,
    true
  ),
  (
    'third_bible_study',
    'Third Bible Study',
    '3rd Study',
    'Momentum is building through the early lessons.',
    'indigo',
    3000,
    true
  ),
  (
    'seventh_bible_study',
    'Seventh Bible Study',
    '7th Study',
    'A consistent study rhythm is established.',
    'violet',
    4000,
    true
  ),
  (
    'ready_for_baptism',
    'Ready for Baptism',
    'Ready',
    'Final preparation, questions, and care before baptism.',
    'emerald',
    5000,
    true
  ),
  (
    'baptized',
    'Baptized',
    'Baptized',
    'Shown for the current month, then kept in history.',
    'green',
    6000,
    true
  )
on conflict (id) do update
set
  label = excluded.label,
  short_label = excluded.short_label,
  description = excluded.description,
  tone = excluded.tone,
  sort_order = excluded.sort_order,
  is_system = true;

drop index if exists public.people_active_stage_sort_idx;
drop index if exists public.people_baptized_at_idx;

alter table public.people
  alter column stage drop default,
  alter column stage type text using stage::text,
  alter column stage set default 'hunting';

alter table public.person_events
  alter column from_stage type text using from_stage::text,
  alter column to_stage type text using to_stage::text;

alter table public.people
  add constraint people_stage_fkey
  foreign key (stage)
  references public.stages(id);

alter table public.person_events
  add constraint person_events_from_stage_fkey
  foreign key (from_stage)
  references public.stages(id),
  add constraint person_events_to_stage_fkey
  foreign key (to_stage)
  references public.stages(id);

create index people_active_stage_sort_idx
  on public.people (stage, sort_order, created_at)
  where archived_at is null;

create index people_baptized_at_idx
  on public.people (baptized_at)
  where archived_at is null and stage = 'baptized';

create index stages_visible_sort_idx
  on public.stages (sort_order, label)
  where is_hidden = false;

create or replace function public.set_stages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stages_set_updated_at on public.stages;

create trigger stages_set_updated_at
before update on public.stages
for each row
execute function public.set_stages_updated_at();

alter table public.stages enable row level security;

drop type if exists public.study_stage;
