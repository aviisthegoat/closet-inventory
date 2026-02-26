"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type ItemOption = {
  id: string;
  label: string;
  maxQty: number;
  unit: string;
};

type BinOption = { id: string; label: string };

type CheckoutLine = { itemId: string; quantity: number; label: string; unit: string };

export default function NewCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBinId = searchParams.get("binId") ?? undefined;

  const [items, setItems] = useState<ItemOption[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<string>(preselectedBinId ?? "");
  const [borrowerName, setBorrowerName] = useState("");
  const [clubName, setClubName] = useState("");
  const [eventName, setEventName] = useState("");
  const [dueBackAt, setDueBackAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [itemsRes, binsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, quantity_on_hand, unit, item_groups(name), bins(label)")
          .order("created_at", { ascending: false }),
        supabase.from("bins").select("id, label").order("label", { ascending: true }),
      ]);
      setItems(
        (itemsRes.data ?? []).map((r: any) => ({
          id: r.id,
          label: `${r.item_groups?.name ?? "Item"} · ${r.bins?.label ?? "No bin"} (${r.quantity_on_hand} ${r.unit})`,
          maxQty: Number(r.quantity_on_hand) || 999,
          unit: r.unit ?? "pcs",
        }))
      );
      setBins((binsRes.data ?? []).map((b: any) => ({ id: b.id, label: b.label })));
    };
    load();
  }, []);

  const addLine = () => {
    const first = items[0];
    if (!first) return;
    setLines((prev) => [
      ...prev,
      { itemId: first.id, quantity: 1, label: first.label, unit: first.unit },
    ]);
  };

  const updateLine = (index: number, updates: Partial<CheckoutLine>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const setLineItem = (index: number, itemId: string) => {
    const opt = items.find((i) => i.id === itemId);
    if (!opt) return;
    updateLine(index, {
      itemId: opt.id,
      label: opt.label,
      unit: opt.unit,
      quantity: Math.min(lines[index]?.quantity ?? 1, opt.maxQty),
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0 && !selectedBinId) {
      setError("Add at least one item or select a bin.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const batchId = crypto.randomUUID();
    const due = dueBackAt ? new Date(dueBackAt).toISOString() : null;
    const base = {
      checkout_batch_id: batchId,
      borrower_name: borrowerName,
      club_name: clubName || null,
      event_name: eventName || null,
      due_back_at: due,
      notes: notes || null,
    };

    // Validate that we are not over-lending items that are already out.
    const itemTotals = new Map<string, number>();
    for (const line of lines) {
      itemTotals.set(
        line.itemId,
        (itemTotals.get(line.itemId) ?? 0) + line.quantity,
      );
    }

    for (const [itemId, requested] of itemTotals.entries()) {
      const [{ data: item, error: itemError }, { data: active, error: activeError }] =
        await Promise.all([
          supabase
            .from("items")
            .select("quantity_on_hand, item_groups(name)")
            .eq("id", itemId)
            .single(),
          supabase
            .from("checkouts")
            .select("quantity")
            .eq("item_id", itemId)
            .eq("status", "checked_out"),
        ]);

      if (itemError) {
        setError(itemError.message);
        setSaving(false);
        return;
      }
      if (activeError && activeError.code !== "PGRST116") {
        // PGRST116 = no rows; safe to ignore
        setError(activeError.message);
        setSaving(false);
        return;
      }

      const totalOut =
        (active ?? []).reduce(
          (sum, row: any) => sum + Number(row.quantity ?? 0),
          0,
        ) || 0;
      const onHand = Number((item as any)?.quantity_on_hand ?? 0);
      const available = onHand - totalOut;

      if (requested > available) {
        const name = (item as any)?.item_groups?.name ?? "This item";
        setError(
          `${name} only has ${available} available right now. You tried to check out ${requested}.`,
        );
        setSaving(false);
        return;
      }
    }

    // Validate that a bin is not checked out twice at the same time.
    if (selectedBinId) {
      const { data: activeBin, error: binError } = await supabase
        .from("checkouts")
        .select("id")
        .eq("bin_id", selectedBinId)
        .eq("status", "checked_out");
      if (binError && binError.code !== "PGRST116") {
        setError(binError.message);
        setSaving(false);
        return;
      }
      if (activeBin && activeBin.length > 0) {
        setError("That bin is already checked out to someone else.");
        setSaving(false);
        return;
      }
    }

    const rows: any[] = [];
    for (const line of lines) {
      rows.push({ ...base, item_id: line.itemId, quantity: line.quantity });
    }
    if (selectedBinId) {
      rows.push({ ...base, bin_id: selectedBinId, item_id: null, quantity: null });
    }

    // #region agent log
    fetch("http://127.0.0.1:7815/ingest/b307b67c-0b91-415b-ba95-a48343d93232", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ddae03",
      },
      body: JSON.stringify({
        sessionId: "ddae03",
        runId: "pre-fix",
        hypothesisId: "H-insert",
        location: "checkout/new/page.tsx:handleSubmit:beforeInsert",
        message: "About to insert checkout rows",
        data: { batchId, rowsCount: rows.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const { error: insertError } = await supabase.from("checkouts").insert(rows);

    // #region agent log
    fetch("http://127.0.0.1:7815/ingest/b307b67c-0b91-415b-ba95-a48343d93232", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ddae03",
      },
      body: JSON.stringify({
        sessionId: "ddae03",
        runId: "pre-fix",
        hypothesisId: "H-insert",
        location: "checkout/new/page.tsx:handleSubmit:afterInsert",
        message: "Checkout insert result",
        data: { batchId, hasError: !!insertError, errorMessage: insertError?.message ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      userId: null,
      action: "checkout_created",
      entityType: "checkout",
      entityId: batchId,
      details: {
        items_count: lines.length,
        bin_id: selectedBinId || null,
        borrower_name: borrowerName,
        club_name: clubName || null,
        event_name: eventName || null,
        due_back_at: due,
      },
    });
    router.push("/checkouts");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          New checkout
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add multiple items and/or a bin for one borrower and event.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">Items to checkout</h2>
          <button
            type="button"
            onClick={addLine}
            className="rounded-2xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            + Add item
          </button>
        </div>
        {lines.length === 0 && !selectedBinId && (
          <p className="text-xs text-zinc-500">
            Click &quot;+ Add item&quot; to add items, or select a bin below (or both).
          </p>
        )}
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2"
            >
              <select
                value={line.itemId}
                onChange={(e) => setLineItem(index, e.target.value)}
                className="min-w-[200px] flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={items.find((i) => i.id === line.itemId)?.maxQty ?? 999}
                value={line.quantity}
                onChange={(e) =>
                  updateLine(index, { quantity: Number(e.target.value) || 1 })
                }
                className="w-16 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-zinc-500">{line.unit}</span>
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Or checkout an entire bin (optional)
          </label>
          <select
            value={selectedBinId}
            onChange={(e) => setSelectedBinId(e.target.value)}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          >
            <option value="">No bin</option>
            {bins.map((bin) => (
              <option key={bin.id} value={bin.id}>
                {bin.label}
              </option>
            ))}
          </select>
        </div>

        <hr className="border-zinc-200" />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Borrower name
            </label>
            <input
              required
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Student or staff name"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Club / organization (optional)
            </label>
            <input
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="e.g. Marketing Club"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Event / use (optional)
          </label>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Fall Gala"
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Expected return date (optional)
          </label>
          <input
            type="date"
            value={dueBackAt}
            onChange={(e) => setDueBackAt(e.target.value)}
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
            rows={2}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create checkout"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/checkouts")}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
