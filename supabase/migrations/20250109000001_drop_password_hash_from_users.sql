-- Revert: remove password_hash column (using Supabase Auth instead)

alter table public.users
  drop column if exists password_hash;
