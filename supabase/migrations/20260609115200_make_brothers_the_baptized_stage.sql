update public.stages
set
  label = 'Baptized',
  short_label = 'Baptized',
  description = 'Baptized contacts continuing in care and service.',
  tone = 'green',
  is_hidden = false,
  is_system = true
where id = 'brothers';

update public.stages
set
  description = 'Legacy baptized lane; existing contacts are moved into Baptized.',
  is_hidden = true,
  is_system = true
where id = 'baptized';

with brothers_sort as (
  select coalesce(max(sort_order), 0) as max_sort_order
  from public.people
  where archived_at is null
    and stage = 'brothers'
),
legacy_baptized as (
  select
    p.id,
    row_number() over (
      order by p.baptized_at asc nulls last, p.created_at asc, p.id asc
    ) as order_rank
  from public.people as p
  where p.archived_at is null
    and p.stage = 'baptized'
),
promoted as (
  update public.people as p
  set
    stage = 'brothers',
    sort_order = brothers_sort.max_sort_order + (legacy_baptized.order_rank * 1000)
  from legacy_baptized
  cross join brothers_sort
  where p.id = legacy_baptized.id
  returning p.id
)
insert into public.person_events (
  person_id,
  event_type,
  title,
  body,
  from_stage,
  to_stage
)
select
  id,
  'stage_moved',
  'Moved to Baptized',
  'Automatically moved into the single baptized lane.',
  'baptized',
  'brothers'
from promoted;
