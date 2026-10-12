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

commit;
