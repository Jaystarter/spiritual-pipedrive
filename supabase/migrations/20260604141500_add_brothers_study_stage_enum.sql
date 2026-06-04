-- The "Brothers" stage (added to public.stages in 20260604122300) is rejected on
-- any database where public.people.stage is still the legacy study_stage enum,
-- because that enum was never taught the value: "invalid input value for enum
-- study_stage: brothers". Add the value where the enum still exists.
--
-- On databases where 20260519094400_editable_stacks already converted the stage
-- columns to text and dropped study_stage, the type is gone, so the guard below
-- makes this a safe no-op (keeps `supabase db reset` working).
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'study_stage' and n.nspname = 'public'
  ) then
    alter type public.study_stage add value if not exists 'brothers';
  end if;
end
$$;
