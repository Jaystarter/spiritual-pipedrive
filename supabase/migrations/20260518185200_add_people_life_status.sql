alter table public.people
  add column if not exists life_status text;

alter table public.people
  drop constraint if exists people_life_status_check;

alter table public.people
  add constraint people_life_status_check
  check (life_status is null or life_status in ('student', 'worker'));
