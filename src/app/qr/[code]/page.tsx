import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

type QrPageProps = {
  params: Promise<{ code: string }>;
};

export default async function QrPage({ params }: QrPageProps) {
  const { code } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: qr } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!qr) {
    notFound();
  }

  if (qr.type === "bin") {
    const { data: bin } = await supabase
      .from("bins")
      .select("id, label, notes, locations(name)")
      .eq("id", qr.target_id)
      .maybeSingle();

    const { data: contents } = await supabase
      .from("items")
      .select("id, quantity_on_hand, unit, item_groups(name)")
      .eq("bin_id", qr.target_id);

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-100">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Bin
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            {bin?.label ?? "Bin"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {bin?.locations?.[0]?.name ?? "Location not assigned"}
          </p>
          {bin?.notes && (
            <p className="mt-3 text-xs text-zinc-500">{bin.notes}</p>
          )}
          <div className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              What&apos;s in this box
            </h2>
            <div className="mt-2 space-y-2">
              {contents && contents.length > 0 ? (
                contents.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {item.item_groups?.name}
                      </p>
                    </div>
                    <p className="text-zinc-600">
                      {item.quantity_on_hand} {item.unit}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400">
                  No items logged in this bin yet.
                </p>
              )}
            </div>
          </div>
          <a
            href={`/bins/${qr.target_id}`}
            className="mt-5 inline-flex rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Open in full dashboard
          </a>
        </div>
      </div>
    );
  }

  // Item-group QR: show where this item lives
  const { data: group } = await supabase
    .from("item_groups")
    .select(
      "id, name, description, default_bin_id, bins:default_bin_id(label, locations(name))",
    )
    .eq("id", qr.target_id)
    .maybeSingle();

  const { data: items } = await supabase
    .from("items")
    .select("id, quantity_on_hand, unit, bins(label, locations(name))")
    .eq("item_group_id", qr.target_id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-100">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Item group
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">
          {group?.name ?? "Item"}
        </h1>
        {group?.description && (
          <p className="mt-1 text-xs text-zinc-500">{group.description}</p>
        )}
        <div className="mt-4 space-y-2 text-xs">
          {items && items.length > 0 ? (
            items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {item.bins?.label ?? "Bin"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {item.bins?.locations?.[0]?.name ?? "Location not assigned"}
                  </p>
                </div>
                <p className="text-zinc-600">
                  {item.quantity_on_hand} {item.unit}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400">
              No items logged for this group yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

