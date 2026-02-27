## Closet Inventory Management & Checkout App

A mobile-friendly inventory system for your shared storage closet with:

- **Searchable dashboard** for all items, bins, and shelves.
- **Checkout / check-in log** for clubs and events.
- **QR codes** on each bin or item group (scan from your phone to jump into the app).
- **Closet map** that mirrors your shelves/zones.
- **Low stock alerts**, item finder, and “what’s in this box?” views.

Built with **Next.js App Router**, **Supabase (Postgres + Auth + Storage)**, and **Tailwind CSS**.

---

## 1. Local setup

From the `inventory-closet` folder:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

> Note: If `npm install` fails, update Node/npm and try again; this project uses modern Next.js and Tailwind.

---

## 2. Supabase configuration

1. **Create a Supabase project** at `https://supabase.com`.
2. In Supabase:
   - Go to **SQL Editor** and run the SQL files in `supabase/migrations` in order:
     - `001_initial_schema.sql`
     - `002_rls_policies.sql`
   - In **Authentication → Providers**, enable **Email** sign-in (magic links are recommended).
   - In **Storage → Buckets**, create a bucket named `closet-photos` (public or with read policies).
3. In the Supabase dashboard, copy:
   - Project URL
   - `anon` public API key
4. Create `.env.local` (from `.env.local.example`) and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Restart `npm run dev` after editing env vars.

---

## 3. App structure & main screens

- `/(auth)/login` – magic‑link login with your school email.
- `/dashboard` – overview (low stock, active checkouts, quick actions).
- `/inventory` – **searchable inventory table** for everything in the closet.
- `/bins` – all bins with quick links, QR generation, and photos.
- `/locations` – define shelves / zones to power the closet map.
- `/map` – **visual closet map** (shelves + their bins).
- `/checkout/new` – start a new checkout (specific items or entire bins).
- `/checkouts` – active + historical checkouts with “check in” actions.
- `/logs` – simple activity list (ready for future expansion).
- `/qr/generate` – generate printable QR codes for bins or item groups.
- `/qr/[code]` – landing page for a scanned QR (either:
  - “What’s in this box?” for a bin, or
  - “Where is this item?” for an item group).
- `/scan` – mobile QR scanner page (camera-based) for quickly jumping to items/bins.

---

## 4. QR workflow

1. From the dashboard, go to **Bins** or **Item groups** and click **QR code** (or visit `/qr/generate`).
2. Select the target bin or group, click **Generate QR**, then print the QR card.
3. Tape the QR to the bin or box.
4. On your phone:
   - Open your deployed site (or `http://localhost:3000/scan`), point at the QR, and you’ll land on `/qr/[code]` which shows:
     - For bins: **“What’s in this box?”** view.
     - For item groups: **“Where is this item?”** across bins/locations.

---

## 5. Deployment (sharing with your team)

1. Push this project to GitHub (or your Git provider).
2. Create a Supabase project (if not already) and ensure migrations have run.
3. Deploy to **Vercel**:
   - Import the repo.
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project settings.
4. Share the Vercel URL with your team – they’ll log in with their institutional email.

---

## 6. Customizing for your closet

- Use the **Locations** page to match your real shelves/walls/floor zones.
- Upload photos to `closet-photos` and set `photo_url` on locations/bins in Supabase for a more visual map.
- Adjust low‑stock thresholds on items directly in the app, then use:
  - `/dashboard` → Low stock summary
  - `/inventory?filter=low-stock` to focus only on what needs refilling.

