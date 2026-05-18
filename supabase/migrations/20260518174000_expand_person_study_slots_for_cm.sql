do $$
declare
  constraint_record record;
begin
  if to_regclass('public.person_studies') is null then
    return;
  end if;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = to_regclass('public.person_studies')
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%study_number%'
  loop
    execute format(
      'alter table public.person_studies drop constraint %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table if exists public.person_studies
  add constraint person_studies_study_number_check
  check (study_number between 1 and 68);
