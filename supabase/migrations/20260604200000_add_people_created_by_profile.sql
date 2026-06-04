-- Track which profile originally entered (created) each contact, so follow-up
-- reminders can be scoped to "contacts you added" rather than to whoever the
-- contact is later assigned to (assigned_profile_ids). Nullable + on delete set
-- null so deleting a profile never orphans a contact row.
alter table public.people
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists people_created_by_profile_idx
  on public.people (created_by_profile_id);

-- Backfill existing rows from each contact's original "created" event actor.
-- Picks the earliest created event per person; contacts without one stay null
-- (they simply won't surface in anyone's follow-up reminders until edited).
update public.people as p
set created_by_profile_id = origin.actor_profile_id
from (
  select distinct on (person_id)
    person_id,
    actor_profile_id
  from public.person_events
  where event_type = 'created'
    and actor_profile_id is not null
  order by person_id, created_at asc
) as origin
where origin.person_id = p.id
  and p.created_by_profile_id is null;
