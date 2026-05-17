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
      'text_reaction',
      'call_reaction',
      'archived'
    )
  );
