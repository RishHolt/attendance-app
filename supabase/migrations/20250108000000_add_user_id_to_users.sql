-- Add user_id as a unique randomized identifier (like employee ID)

alter table public.users
  add column if not exists user_id text unique;

-- Backfill existing users with random 8-digit user_ids
do $$
declare
  r record;
  new_id text;
begin
  for r in select id from public.users where user_id is null
  loop
    loop
      new_id := lpad(floor(random() * 89999999 + 10000000)::text, 8, '0');
      begin
        update public.users set user_id = new_id where id = r.id;
        exit;
      exception when unique_violation then
        null; -- retry with new random
      end;
    end loop;
  end loop;
end
$$;

-- Make user_id not null after backfill
alter table public.users
  alter column user_id set not null;

create index if not exists users_user_id_idx on public.users (user_id);
