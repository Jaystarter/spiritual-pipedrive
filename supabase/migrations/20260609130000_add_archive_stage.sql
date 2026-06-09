-- Add the "Archive" lane as a visible, manual-only stage that sits after the
-- final "Brothers"/"Baptized" lane. public.people.stage is text with a foreign
-- key to public.stages(id) (see 20260519094400_editable_stacks), so this row
-- must exist before any contact can be moved into the archive column.
-- Idempotent: re-running is a no-op once the row exists.
insert into public.stages (
  id,
  label,
  short_label,
  description,
  tone,
  sort_order,
  is_hidden,
  is_system
)
values (
  'archive',
  'Archive',
  'Archive',
  'Set aside — no longer actively studying.',
  'violet',
  8000,
  false,
  true
)
on conflict (id) do nothing;
