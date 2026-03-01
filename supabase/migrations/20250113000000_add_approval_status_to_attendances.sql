-- Add approval_status to attendances: pending (default) or approved

alter table public.attendances
  add column if not exists approval_status text not null default 'pending' check (approval_status in ('pending', 'approved'));

create index if not exists attendances_approval_status_idx on public.attendances (approval_status);

comment on column public.attendances.approval_status is 'Admin approval: pending (default) or approved';
