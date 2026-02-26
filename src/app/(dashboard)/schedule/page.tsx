import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { ScheduleClient, type ScheduleRow } from "./ScheduleClient";

export default async function SchedulePage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, borrower_name, club_name, event_name, quantity, status, start_at, end_at, items(item_groups(name)), bins(label)",
    )
    .order("start_at", { ascending: true });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Schedule
        </h1>
        <p className="text-sm text-rose-600">
          There was a problem loading the schedule: {error.message}
        </p>
      </div>
    );
  }

  const rows: ScheduleRow[] =
    data?.map((c: any) => {
      const itemLabel =
        c.items?.item_groups?.name ??
        c.bins?.label ??
        "Item or bin";
      return {
        id: c.id as string,
        borrower_name: c.borrower_name as string,
        club_name: (c.club_name as string | null) ?? null,
        event_name: (c.event_name as string | null) ?? null,
        quantity:
          c.quantity !== null && c.quantity !== undefined
            ? Number(c.quantity)
            : null,
        status: c.status as "planned" | "confirmed" | "cancelled" | "fulfilled",
        start_at: c.start_at as string | null,
        end_at: c.end_at as string | null,
        item_label: itemLabel,
      };
    }) ?? [];

  return <ScheduleClient initial={rows} />;
}

