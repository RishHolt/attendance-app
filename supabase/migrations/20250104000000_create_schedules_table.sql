-- Schedules table for recurring weekly shifts per user

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint schedules_end_after_start check (end_time > start_time)
);

alter table public.schedules enable row level security;

create policy "Authenticated users can read schedules"
  on public.schedules for select to authenticated using (true);

create policy "Authenticated users can insert schedules"
  on public.schedules for insert to authenticated with check (true);

create policy "Authenticated users can update schedules"
  on public.schedules for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete schedules"
  on public.schedules for delete to authenticated using (true);

create index schedules_user_id_idx on public.schedules (user_id);
create index schedules_day_idx on public.schedules (day_of_week);
