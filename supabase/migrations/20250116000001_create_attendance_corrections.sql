-- Attendance corrections: user requests to fix missing/incorrect time_in or time_out

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_time_in time,
  requested_time_out time,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attendance_corrections"
  ON public.attendance_corrections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert attendance_corrections"
  ON public.attendance_corrections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance_corrections"
  ON public.attendance_corrections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX attendance_corrections_attendance_id_idx ON public.attendance_corrections (attendance_id);
CREATE INDEX attendance_corrections_status_idx ON public.attendance_corrections (status);
