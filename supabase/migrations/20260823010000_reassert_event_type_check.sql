-- Production's migration history is partial: several May–June migrations were
-- applied by hand without history rows, while 20260719084500 (acknowledged)
-- IS recorded. Replaying the un-recorded 20260519112600 would therefore
-- regress person_events_event_type_check to a pre-acknowledged version, and
-- the July migration would not re-run to fix it. This final re-assert makes
-- the chain converge on the complete list no matter which prefix replayed.
-- Idempotent and harmless on fresh databases.
alter table public.person_events
  drop constraint if exists person_events_event_type_check;

alter table public.person_events
  add constraint person_events_event_type_check
  check (
    event_type in (
      'created',
      'stage_moved',
      'details_updated',
      'assigned',
      'note_added',
      'study_logged',
      'text_reaction',
      'call_reaction',
      'archived',
      'acknowledged'
    )
  );
