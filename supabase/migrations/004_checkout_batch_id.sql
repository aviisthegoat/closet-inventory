-- Allow grouping multiple items into one checkout (e.g. many items for one event).
alter table public.checkouts
  add column if not exists checkout_batch_id uuid;
