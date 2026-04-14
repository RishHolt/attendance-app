-- Add role column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'employee'
  CHECK (role IN ('employee', 'admin', 'ojt'));

-- Set all existing users to ojt (current batch are all interns)
UPDATE public.users SET role = 'ojt' WHERE role = 'employee';

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
