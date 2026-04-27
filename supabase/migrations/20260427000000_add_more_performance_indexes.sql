-- Composite index for the hottest attendance query path:
-- list endpoint filters by user_id, orders by attendance_date DESC, often filters by status
CREATE INDEX IF NOT EXISTS attendances_user_date_status_idx
  ON public.attendances (user_id, attendance_date DESC, status);

-- Corrections are looked up by attendance_id when joining with attendance lists
CREATE INDEX IF NOT EXISTS attendance_corrections_attendance_id_idx
  ON public.attendance_corrections (attendance_id);

-- Corrections list endpoint filters by status (pending/approved/denied)
CREATE INDEX IF NOT EXISTS attendance_corrections_status_idx
  ON public.attendance_corrections (status);

-- Middleware looks up user role by email on every protected request
CREATE INDEX IF NOT EXISTS users_email_idx
  ON public.users (lower(email));
