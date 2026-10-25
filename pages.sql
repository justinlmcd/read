-- READ pages. Run once in your Supabase SQL editor (same project as setup.sql). Safe to run again.
begin;

-- How long each book is, so progress can show as pages read out of the total.
alter table public.books add column if not exists total_pages int check (total_pages between 1 and 20000);

-- One row per day's reading: how many pages of which book.
create table if not exists public.reading_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  book_id uuid not null references public.books(id) on delete cascade,
  read_on date not null,
  pages int not null check (pages between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists reading_log_by_day on public.reading_log (user_id, read_on desc);
create index if not exists reading_log_by_book on public.reading_log (user_id, book_id);
alter table public.reading_log enable row level security;

drop policy if exists rl_read on public.reading_log;
drop policy if exists rl_write on public.reading_log;
drop policy if exists rl_edit on public.reading_log;
drop policy if exists rl_remove on public.reading_log;
create policy rl_read   on public.reading_log for select using (user_id = auth.uid());
create policy rl_write  on public.reading_log for insert with check (user_id = auth.uid());
create policy rl_edit   on public.reading_log for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rl_remove on public.reading_log for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.reading_log to authenticated;
commit;
