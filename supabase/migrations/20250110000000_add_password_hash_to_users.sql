-- Add password_hash column to store bcrypt hashes (users table only, not Supabase Auth)

alter table public.users
  add column if not exists password_hash text;

comment on column public.users.password_hash is 'bcrypt hash of user password; used for custom auth'
