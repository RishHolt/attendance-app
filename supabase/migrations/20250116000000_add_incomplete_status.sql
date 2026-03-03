-- Add 'incomplete' to attendance status
-- incomplete = has time_in but no time_out (forgot to clock out)

ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
ALTER TABLE public.attendances ADD CONSTRAINT attendances_status_check
  CHECK (status IN ('present', 'late', 'absent', 'incomplete'));
