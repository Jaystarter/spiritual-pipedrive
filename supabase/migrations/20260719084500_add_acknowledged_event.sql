-- Acknowledgement: "I have seen this person and I will follow up."
--
-- The quiet clock (days since last real activity) must stay honest, so
-- acknowledging is deliberately NOT an activity. `getActivityCandidates` in
-- src/lib/follow-ups.ts filters this event type out the same way it already
-- filters 'assigned', which keeps the day counter climbing while the board
-- and the push digest go quiet.
--
-- The acknowledgement window itself rides on people.next_follow_up_at
-- (added in 20260517111500_add_person_events.sql); this event exists for the
-- journal trail and actor attribution.
--
-- event_type is text + a named CHECK constraint, so extending it means the
-- established drop-and-recreate dance from
-- 20260519112600_add_assignment_notifications.sql.

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
