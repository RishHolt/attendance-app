-- Store default schedule template per user for robust default vs custom day logic
-- Prevents default from being incorrectly derived when reloading after save

create table if not exists public.user_schedule_defaults (
  user_id uuid primary key references public.users(id) on delete cascade,
  time_in time not null,
  time_out time not null,
  break_time time,
  break_duration numeric(4, 2) check (break_duration >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_schedule_defaults_end_after_start check (time_out > time_in)
);

alter table public.user_schedule_defaults enable row level security;

create policy "Authenticated users can read schedule defaults"
  on public.user_schedule_defaults for select to authenticated using (true);

create policy "Authenticated users can insert schedule defaults"
  on public.user_schedule_defaults for insert to authenticated with check (true);

create policy "Authenticated users can update schedule defaults"
  on public.user_schedule_defaults for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete schedule defaults"
  on public.user_schedule_defaults for delete to authenticated using (true);

create or replace function public.update_user_schedule_defaults_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_schedule_defaults_updated_at
  before update on public.user_schedule_defaults
  for each row execute procedure public.update_user_schedule_defaults_updated_at();
