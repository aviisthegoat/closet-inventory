import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function BinDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: bin } = await supabase
    .from("bins")
    .select("id, label, notes, photo_url, location_id, locations(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!bin) notFound();

  const { data: items } = await supabase
    .from("items")
    .select("id, quantity_on_hand, unit, item_groups(id, name)")
    .eq("bin_id", id);

  const locationName = (bin.locations as { name?: string } | null)?.name ?? "No location";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-4">
          {bin.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bin.photo_url}
              alt={bin.label}
              className="h-24 w-24 rounded-2xl object-cover ring-1 ring-zinc-200"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {bin.label}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{locationName}</p>
            {bin.notes && (
              <p className="mt-2 text-sm text-zinc-600">{bin.notes}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/checkout/new?binId=${bin.id}`}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            Check out this bin
          </Link>
          <Link
            href={`/bins?edit=${bin.id}`}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Edit bin
          </Link>
          <Link
            href={`/qr/generate?binId=${bin.id}`}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            QR code
          </Link>
          <Link
            href="/bins"
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50"
          >
            Back to bins
          </Link>
        </div>
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          What&apos;s in this box
        </h2>
        <div className="mt-3 space-y-2">
          {items && items.length > 0 ? (
            items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-zinc-900">
                  {item.item_groups?.name ?? "Item"}
                </span>
                <span className="text-zinc-600">
                  {item.quantity_on_hand} {item.unit}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              No items logged in this bin yet. Add items from the Inventory page
              and assign them to this bin.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
