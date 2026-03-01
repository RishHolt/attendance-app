-- Add break time, break duration, and custom date to schedules
-- custom_date: when set, schedule applies to that specific date only (day_of_week ignored)
-- day_of_week: when custom_date is null, applies to that weekday (0=Sun, 6=Sat)

alter table public.schedules
  rename column start_time to time_in;

alter table public.schedules
  rename column end_time to time_out;

alter table public.schedules
  add column if not exists break_time time,
  add column if not exists break_duration smallint check (break_duration >= 0),
  add column if not exists custom_date date;

-- Allow day_of_week to be null when custom_date is set (drop range check)
alter table public.schedules
  drop constraint if exists schedules_day_of_week_check;

alter table public.schedules
  alter column day_of_week drop not null;

-- Constraint: either day_of_week or custom_date must be set
alter table public.schedules
  add constraint schedules_day_or_custom check (
    (day_of_week is not null and custom_date is null) or
    (day_of_week is null and custom_date is not null)
  );

create index if not exists schedules_custom_date_idx on public.schedules (custom_date) where custom_date is not null;
