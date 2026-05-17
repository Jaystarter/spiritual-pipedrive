alter table public.person_studies
  add column if not exists title text;

update public.person_studies
set title = 'Study ' || study_number::text
where title is null or char_length(trim(title)) = 0;

alter table public.person_studies
  alter column title set not null;

alter table public.person_studies
  drop constraint if exists person_studies_title_chk;

alter table public.person_studies
  add constraint person_studies_title_chk
  check (char_length(trim(title)) between 1 and 80);
