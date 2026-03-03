-- Drop username column from users table (login uses email only)
alter table public.users drop column if exists username;
