do $$
declare
  baptized_order integer;
  next_stage_order integer;
  brothers_order integer;
begin
  select sort_order
  into baptized_order
  from public.stages
  where id = 'baptized';

  if baptized_order is null then
    select coalesce(max(sort_order), 6000)
    into baptized_order
    from public.stages;
  end if;

  select min(sort_order)
  into next_stage_order
  from public.stages
  where sort_order > baptized_order;

  if next_stage_order is null then
    brothers_order := baptized_order + 1000;
  elsif next_stage_order - baptized_order > 1 then
    brothers_order := baptized_order + ((next_stage_order - baptized_order) / 2);
  else
    update public.stages
    set sort_order = sort_order + 1000
    where sort_order > baptized_order;

    brothers_order := baptized_order + 1000;
  end if;

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
    'brothers',
    'Brothers',
    'Brothers',
    'Baptized brothers continuing in care and service.',
    'amber',
    brothers_order,
    false,
    true
  )
  on conflict (id) do update
  set
    label = excluded.label,
    short_label = excluded.short_label,
    description = excluded.description,
    tone = excluded.tone,
    sort_order = excluded.sort_order,
    is_hidden = false,
    is_system = true;
end $$;
