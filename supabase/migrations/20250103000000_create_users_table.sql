-- Users table for attendance app user/employee management

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text unique,
  email text not null unique,
  contact_no text,
  position text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_length check (username is null or char_length(username) >= 3)
);

alter table public.users enable row level security;

create policy "Authenticated users can read"
  on public.users for select to authenticated using (true);

create policy "Authenticated users can insert"
  on public.users for insert to authenticated with check (true);

create policy "Authenticated users can update"
  on public.users for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete"
  on public.users for delete to authenticated using (true);

create index users_email_idx on public.users (email);
create index users_username_idx on public.users (username);
create index users_status_idx on public.users (status);

create or replace function public.update_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.update_users_updated_at();
