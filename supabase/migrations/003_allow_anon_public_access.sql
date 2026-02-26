-- Allow public (anon) access so the app works without login.
-- Anyone with the app URL can view and edit inventory. Good for a shared team closet.

create policy "anon_all_locations" on public.locations
  for all using (true) with check (true);

create policy "anon_all_bins" on public.bins
  for all using (true) with check (true);

create policy "anon_all_item_groups" on public.item_groups
  for all using (true) with check (true);

create policy "anon_all_items" on public.items
  for all using (true) with check (true);

create policy "anon_all_checkouts" on public.checkouts
  for all using (true) with check (true);

create policy "anon_all_qr_codes" on public.qr_codes
  for all using (true) with check (true);

create policy "anon_all_activity_logs" on public.activity_logs
  for all using (true) with check (true);

-- Profiles stay restricted (only own profile) for when/if you enable login later.
