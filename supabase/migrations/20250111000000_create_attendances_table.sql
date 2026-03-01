-- Attendances table: records per user per date (only for dates with schedule)

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'late', 'absent')),
  time_in time,
  time_out time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendances_user_date_unique unique (user_id, attendance_date)
);

alter table public.attendances enable row level security;

create policy "Authenticated users can read attendances"
  on public.attendances for select to authenticated using (true);

create policy "Authenticated users can insert attendances"
  on public.attendances for insert to authenticated with check (true);

create policy "Authenticated users can update attendances"
  on public.attendances for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete attendances"
  on public.attendances for delete to authenticated using (true);

create index attendances_user_id_idx on public.attendances (user_id);
create index attendances_date_idx on public.attendances (attendance_date);

create or replace function public.update_attendances_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger attendances_updated_at
  before update on public.attendances
  for each row execute procedure public.update_attendances_updated_at();
