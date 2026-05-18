alter table public.people
  add column if not exists avatar_url text;

alter table public.people
  drop constraint if exists people_avatar_url_size_chk;

alter table public.people
  add constraint people_avatar_url_size_chk
  check (
    avatar_url is null
    or (
      char_length(avatar_url) <= 100000
      and avatar_url ~ '^data:image/(png|jpeg|jpg|webp);base64,'
    )
  );
