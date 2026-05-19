alter table public.profiles
  add column if not exists avatar_offset_x numeric not null default 50,
  add column if not exists avatar_offset_y numeric not null default 50,
  add column if not exists avatar_scale numeric not null default 1;

alter table public.profiles
  drop constraint if exists profiles_avatar_offset_x_chk;
alter table public.profiles
  drop constraint if exists profiles_avatar_offset_y_chk;
alter table public.profiles
  drop constraint if exists profiles_avatar_scale_chk;

alter table public.profiles
  add constraint profiles_avatar_offset_x_chk
  check (avatar_offset_x >= 0 and avatar_offset_x <= 100);

alter table public.profiles
  add constraint profiles_avatar_offset_y_chk
  check (avatar_offset_y >= 0 and avatar_offset_y <= 100);

alter table public.profiles
  add constraint profiles_avatar_scale_chk
  check (avatar_scale >= 1 and avatar_scale <= 3);
