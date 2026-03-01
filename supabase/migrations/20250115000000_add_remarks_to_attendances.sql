-- Add remarks column for deny reason/notes

alter table public.attendances
  add column if not exists remarks text;

comment on column public.attendances.remarks is 'Admin remarks when attendance is denied; visible to user';
