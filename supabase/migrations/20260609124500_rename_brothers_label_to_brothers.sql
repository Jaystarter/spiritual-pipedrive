-- Display the final lane as "Brothers" again. A prior migration
-- (20260609115200) relabeled the `brothers` stage to "Baptized" while
-- consolidating the legacy `baptized` lane; the lane should now read "Brothers".
-- Idempotent: re-running simply re-applies the same label.
update public.stages
set
  label = 'Brothers',
  short_label = 'Brothers'
where id = 'brothers';
