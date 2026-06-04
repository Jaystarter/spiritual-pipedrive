update public.stages
set description = 'Shown for the baptism month, then moved to Brothers.'
where id = 'baptized';

with current_month as (
  select date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' as starts_at
),
brothers_sort as (
  select coalesce(max(sort_order), 0) as max_sort_order
  from public.people
  where archived_at is null
    and stage = 'brothers'
),
expired_baptisms as (
  select
    p.id,
    p.sort_order,
    row_number() over (
      order by p.baptized_at asc, p.created_at asc, p.id asc
    ) as order_rank
  from public.people as p
  cross join current_month
  where p.archived_at is null
    and p.stage = 'baptized'
    and p.baptized_at is not null
    and p.baptized_at < current_month.starts_at
),
promoted as (
  update public.people as p
  set
    stage = 'brothers',
    sort_order = brothers_sort.max_sort_order + (expired_baptisms.order_rank * 1000)
  from expired_baptisms
  cross join brothers_sort
  where p.id = expired_baptisms.id
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
  'Moved to Brothers',
  'Automatically moved after the baptism month ended.',
  'baptized',
  'brothers'
from promoted;
