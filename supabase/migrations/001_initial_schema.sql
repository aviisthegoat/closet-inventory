-- Locations: shelves, floor zones, closet sections
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int,
  photo_url text,
  created_at timestamptz default now()
);

-- Bins: physical containers on shelves/floor
create table if not exists public.bins (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  location_id uuid references public.locations(id) on delete set null,
  photo_url text,
  qr_code_id uuid,
  notes text,
  created_at timestamptz default now()
);

-- Item groups: logical groupings like "Christmas lights"
create table if not exists public.item_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  photo_url text,
  default_bin_id uuid references public.bins(id) on delete set null,
  created_at timestamptz default now()
);

-- Items: trackable inventory rows
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item_group_id uuid references public.item_groups(id) on delete cascade,
  bin_id uuid references public.bins(id) on delete set null,
  quantity_on_hand numeric(10,2) not null default 0,
  unit text default 'pcs',
  low_stock_threshold numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

-- QR codes mapping
create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('bin', 'item_group')),
  target_id uuid not null,
  created_at timestamptz default now()
);

-- Checkouts: borrowing log
create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  bin_id uuid references public.bins(id) on delete set null,
  borrower_name text not null,
  borrower_type text,
  club_name text,
  event_name text,
  quantity numeric(10,2),
  checked_out_at timestamptz default now(),
  due_back_at timestamptz,
  checked_in_at timestamptz,
  status text not null default 'checked_out' check (status in ('checked_out', 'returned', 'lost')),
  notes text
);

-- Profiles: user metadata and roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff', 'viewer')),
  created_at timestamptz default now()
);

-- Activity logs: audit trail
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- Helpful indexes for search
create index if not exists idx_item_groups_name on public.item_groups using gin (to_tsvector('english', name));
create index if not exists idx_items_notes on public.items using gin (to_tsvector('english', coalesce(notes, '')));
create index if not exists idx_bins_label on public.bins (label);
create index if not exists idx_locations_name on public.locations (name);

-- View for items with status info
create or replace view public.v_items_with_status as
select
  i.id,
  ig.name as item_group_name,
  b.label as bin_label,
  l.name as location_name,
  i.quantity_on_hand,
  i.unit,
  i.low_stock_threshold,
  exists (
    select 1 from public.checkouts c
    where c.item_id = i.id and c.status = 'checked_out'
  ) as is_checked_out
from public.items i
left join public.item_groups ig on ig.id = i.item_group_id
left join public.bins b on b.id = i.bin_id
left join public.locations l on l.id = b.location_id;

-- View for low stock items
create or replace view public.v_low_stock_items as
select *
from public.v_items_with_status
where low_stock_threshold is not null
  and quantity_on_hand <= low_stock_threshold;

