-- Add 'denied' to attendance approval_status

alter table public.attendances
  drop constraint if exists attendances_approval_status_check;

alter table public.attendances
  add constraint attendances_approval_status_check check (approval_status in ('pending', 'approved', 'denied'));

comment on column public.attendances.approval_status is 'Admin approval: pending (default), approved, or denied';
