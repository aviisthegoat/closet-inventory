-- Enable Row Level Security
alter table public.locations enable row level security;
alter table public.bins enable row level security;
alter table public.item_groups enable row level security;
alter table public.items enable row level security;
alter table public.checkouts enable row level security;
alter table public.qr_codes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.profiles enable row level security;

-- Helper policy: only authenticated users
create policy "authenticated_select_locations" on public.locations
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_bins" on public.bins
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_item_groups" on public.item_groups
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_items" on public.items
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_checkouts" on public.checkouts
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_qr_codes" on public.qr_codes
  for select using (auth.role() = 'authenticated');

create policy "authenticated_select_activity_logs" on public.activity_logs
  for select using (auth.role() = 'authenticated');

create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Simple write policy: any authenticated user can insert/update
-- (You can tighten this later to admins only.)
create policy "authenticated_write_locations" on public.locations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_bins" on public.bins
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_item_groups" on public.item_groups
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_items" on public.items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_checkouts" on public.checkouts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_qr_codes" on public.qr_codes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_write_activity_logs" on public.activity_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

