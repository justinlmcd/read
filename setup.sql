-- READ. Run once in your Supabase project (SQL Editor). Safe to share a project with other apps.
begin;

-- Every book you log: who wrote it, what you thought, what you took from it.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  author text not null default '',
  status text not null default 'finished' check (status in ('want','reading','finished')),
  rating int check (rating between 1 and 10),
  finished_on date,
  total_pages int check (total_pages between 1 and 20000),
  takeaways text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_by_user on public.books (user_id, status, finished_on desc);

alter table public.books enable row level security;

create policy b_read   on public.books for select using (user_id = auth.uid());
create policy b_write  on public.books for insert with check (user_id = auth.uid());
create policy b_edit   on public.books for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy b_remove on public.books for delete using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.books to authenticated;

-- One row per day's reading: how many pages of which book.
create table public.reading_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  book_id uuid not null references public.books(id) on delete cascade,
  read_on date not null,
  pages int not null check (pages between 1 and 5000),
  created_at timestamptz not null default now()
);

create index reading_log_by_day on public.reading_log (user_id, read_on desc);
create index reading_log_by_book on public.reading_log (user_id, book_id);
alter table public.reading_log enable row level security;

create policy rl_read   on public.reading_log for select using (user_id = auth.uid());
create policy rl_write  on public.reading_log for insert with check (user_id = auth.uid());
create policy rl_edit   on public.reading_log for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rl_remove on public.reading_log for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.reading_log to authenticated;

commit;
