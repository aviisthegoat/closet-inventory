-- Track lost/broken issues on check-in without changing existing status enum.
alter table public.checkouts
  add column if not exists issue_type text check (issue_type in ('lost', 'broken'));

