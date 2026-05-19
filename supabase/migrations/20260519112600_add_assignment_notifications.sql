alter table public.person_events
  add column if not exists notification_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists person_events_notification_profile_idx
  on public.person_events (notification_profile_id, created_at desc)
  where notification_profile_id is not null;

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
      'archived'
    )
  );
