-- Change break_duration from minutes to hours
-- Converts existing values: 60 min -> 1 hour, 30 min -> 0.5 hour

alter table public.schedules
  drop constraint if exists schedules_break_duration_check;

alter table public.schedules
  alter column break_duration type numeric(4, 2)
  using case
    when break_duration is null then null
    else round((break_duration::numeric / 60), 2)
  end;

alter table public.schedules
  add constraint schedules_break_duration_check check (break_duration >= 0);
