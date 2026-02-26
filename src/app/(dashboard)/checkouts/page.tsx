import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import {
  CheckoutsClient,
  CheckoutGroup,
  CheckoutLine,
} from "./CheckoutsClient";

export default async function CheckoutsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data, error } = await supabase
    .from("checkouts")
    .select(
      "id, checkout_batch_id, borrower_name, club_name, event_name, notes, status, issue_type, quantity, item_id, due_back_at, checked_out_at, items(item_groups(name)), bins(label)",
    )
    .order("checked_out_at", { ascending: false });

  if (error) {
    // In case of a backend error, show a simple message so the page still renders
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Checkouts
        </h1>
        <p className="text-sm text-rose-600">
          There was a problem loading checkouts: {error.message}
        </p>
      </div>
    );
  }

  const rows =
    data?.map((c: any) => ({
      id: c.id as string,
      batchId: (c.checkout_batch_id as string | null) ?? (c.id as string),
      borrower_name: c.borrower_name as string,
      club_name: c.club_name as string | null,
      event_name: c.event_name as string | null,
      notes: (c.notes as string | null) ?? null,
      status: c.status as "checked_out" | "returned" | "lost",
      issue_type: (c.issue_type as "lost" | "broken" | null) ?? null,
      quantity:
        c.quantity !== null && c.quantity !== undefined
          ? Number(c.quantity)
          : null,
      item_id: (c.item_id as string | null) ?? null,
      due_back_at: c.due_back_at as string | null,
      checked_out_at: c.checked_out_at as string | null,
      item_name: c.items?.item_groups?.name as string | null,
      bin_label: c.bins?.label as string | null,
    })) ?? [];

  const groupsMap = new Map<string, CheckoutGroup>();

  for (const row of rows) {
    const key = row.batchId;
    const label = row.item_name ?? row.bin_label ?? "Item / bin";
    const existing = groupsMap.get(key);
    const line: CheckoutLine = {
      id: row.id,
      label,
      quantity: row.quantity,
      item_id: row.item_id,
      status: row.status,
      issue_type: row.issue_type,
    };
    if (!existing) {
      groupsMap.set(key, {
        id: key,
        borrower_name: row.borrower_name,
        club_name: row.club_name,
        event_name: row.event_name,
        notes: row.notes,
        status: row.status,
        due_back_at: row.due_back_at,
        checked_out_at: row.checked_out_at,
        lines: [line],
      });
    } else {
      existing.lines.push(line);
      if (
        existing.status !== "checked_out" &&
        (line.status === "checked_out" ||
          (line.status === "lost" && existing.status === "returned"))
      ) {
        existing.status = line.status;
      }
    }
  }

  const groups = Array.from(groupsMap.values());

  return <CheckoutsClient initialGroups={groups} />;
}

