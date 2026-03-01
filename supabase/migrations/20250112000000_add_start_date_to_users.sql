-- Add start_date to users: the date the employee started working

alter table public.users
  add column if not exists start_date date;

comment on column public.users.start_date is 'Date the employee started working';
