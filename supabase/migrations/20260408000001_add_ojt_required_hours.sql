ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS required_hours integer NULL;
