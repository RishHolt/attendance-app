-- Speeds up analytics GROUP BY and mark-absent queries that filter on both date and status
CREATE INDEX IF NOT EXISTS attendances_date_status_idx
  ON public.attendances (attendance_date, status);

-- Speeds up per-user attendance lookups filtered by date range
CREATE INDEX IF NOT EXISTS attendances_date_user_idx
  ON public.attendances (attendance_date, user_id);

-- Speeds up schedule lookups by user + day_of_week (recurring schedules)
CREATE INDEX IF NOT EXISTS schedules_user_day_idx
  ON public.schedules (user_id, day_of_week)
  WHERE day_of_week IS NOT NULL;

-- Speeds up schedule lookups by user + custom_date (one-off overrides)
CREATE INDEX IF NOT EXISTS schedules_user_custom_date_idx
  ON public.schedules (user_id, custom_date)
  WHERE custom_date IS NOT NULL;
