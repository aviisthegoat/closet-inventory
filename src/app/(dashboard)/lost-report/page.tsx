"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type ItemOption = {
  id: string;
  label: string;
  binLabel: string | null;
  quantityOnHand: number;
  unit: string;
};

type IssueType = "lost" | "broken";

export default function LostReportPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [issueType, setIssueType] = useState<IssueType>("lost");
  const [who, setWho] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: loadError } = await supabase
        .from("items")
        .select(
          "id, quantity_on_hand, unit, item_groups(name), bins(label)",
        )
        .order("created_at", { ascending: false });

      if (loadError) {
        // eslint-disable-next-line no-console
        console.error("Error loading items for loss report:", loadError);
        setError(loadError.message);
        return;
      }

      const opts =
        (data ?? []).map((r: any) => ({
          id: r.id as string,
          label: `${r.item_groups?.name ?? "Item"} · ${
            r.bins?.label ?? "No bin"
          }`,
          binLabel: (r.bins?.label as string | null) ?? null,
          quantityOnHand: Number(r.quantity_on_hand) || 0,
          unit: (r.unit as string | null) ?? "pcs",
        })) ?? [];

      setItems(opts);
      if (opts.length > 0) {
        setSelectedItemId(opts[0].id);
        setQuantity(1);
      }
    };

    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setError("Choose an item.");
      return;
    }
    if (!quantity || quantity <= 0) {
      setError("Enter how many were lost or broken.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const item = items.find((i) => i.id === selectedItemId);
    const safeQty = Math.min(quantity, item?.quantityOnHand ?? quantity);

    // Create a synthetic checkout row so the dashboard lost / broken card picks it up
    const { error: insertError, data: inserted } = await supabase
      .from("checkouts")
      .insert({
        item_id: selectedItemId,
        bin_id: null,
        borrower_name: who || "Internal",
        borrower_type: "internal",
        club_name: null,
        event_name: "Inventory adjustment",
        quantity: safeQty,
        status: "lost",
        issue_type: issueType,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // Reduce stock so low-stock view reflects the loss
    const { data: currentItem } = await supabase
      .from("items")
      .select("quantity_on_hand")
      .eq("id", selectedItemId)
      .single();

    const currentQty = Number(
      (currentItem as any)?.quantity_on_hand ?? item?.quantityOnHand ?? 0,
    );
    const newQty = Math.max(0, currentQty - safeQty);

    await supabase
      .from("items")
      .update({ quantity_on_hand: newQty })
      .eq("id", selectedItemId);

    await logActivity(supabase, {
      userId: null,
      action: "loss_reported",
      entityType: "checkout",
      entityId: (inserted as any)?.id as string,
      details: {
        item_id: selectedItemId,
        quantity: safeQty,
        issue_type: issueType,
        who: who || null,
      },
    });

    router.push("/dashboard");
  };

  const selected = items.find((i) => i.id === selectedItemId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Report lost / broken items
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Log items that were lost or broken even if they weren&apos;t checked
          out through the system.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
      >
        {error && (
          <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Item
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.quantityOnHand} {item.unit} on hand)
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              What happened?
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIssueType("lost")}
                className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                  issueType === "lost"
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                Lost
              </button>
              <button
                type="button"
                onClick={() => setIssueType("broken")}
                className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                  issueType === "broken"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                Broken
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              How many?
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={selected?.quantityOnHand ?? undefined}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="w-24 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              />
              {selected && (
                <span className="text-xs text-zinc-500">
                  of {selected.quantityOnHand} {selected.unit} on hand
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Who noticed this? (optional)
          </label>
          <input
            type="text"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Name or club"
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save report"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

