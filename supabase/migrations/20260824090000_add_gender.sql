-- Gender on both sides of the ledger: workers declare theirs at profile
-- creation and it becomes their default board view; contacts carry theirs so
-- the men/women views have something to filter by. Null means "not recorded"
-- (every pre-existing row) and such rows stay visible in every view.

alter table public.people
  add column if not exists gender text
  check (gender in ('male', 'female'));

alter table public.profiles
  add column if not exists gender text
  check (gender in ('male', 'female'));
