"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type ItemOption = {
  id: string;
  label: string;
  unit: string;
};

type BinOption = {
  id: string;
  label: string;
};

type ReservationLine = {
  itemId: string;
  quantity: number;
  label: string;
  unit: string;
};

type ReservationStatus = "planned" | "confirmed";

export default function NewReservationPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);
  const [lines, setLines] = useState<ReservationLine[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<string>("");
  const [borrowerName, setBorrowerName] = useState("");
  const [clubName, setClubName] = useState("");
  const [eventName, setEventName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<ReservationStatus>("planned");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [itemsRes, binsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, unit, item_groups(name), bins(label)")
          .order("created_at", { ascending: false }),
        supabase
          .from("bins")
          .select("id, label")
          .order("label", { ascending: true }),
      ]);

      if (itemsRes.error) {
        // eslint-disable-next-line no-console
        console.error("Error loading items for reservations:", itemsRes.error);
        setError(itemsRes.error.message);
        return;
      }
      if (binsRes.error) {
        // eslint-disable-next-line no-console
        console.error("Error loading bins for reservations:", binsRes.error);
        setError(binsRes.error.message);
        return;
      }

      const itemOpts: ItemOption[] =
        (itemsRes.data ?? []).map((r: any) => ({
          id: r.id as string,
          label: `${r.item_groups?.name ?? "Item"} · ${
            r.bins?.label ?? "No bin"
          }`,
          unit: (r.unit as string | null) ?? "pcs",
        })) ?? [];
      const binOpts: BinOption[] =
        (binsRes.data ?? []).map((b: any) => ({
          id: b.id as string,
          label: b.label as string,
        })) ?? [];

      setItems(itemOpts);
      setBins(binOpts);
      if (itemOpts.length > 0) {
        // Start with one line by default
        const first = itemOpts[0];
        setLines([
          {
            itemId: first.id,
            quantity: 1,
            label: first.label,
            unit: first.unit,
          },
        ]);
      }
    };
    load();
  }, []);

  const addLine = () => {
    const first = items[0];
    if (!first) return;
    setLines((prev) => [
      ...prev,
      {
        itemId: first.id,
        quantity: 1,
        label: first.label,
        unit: first.unit,
      },
    ]);
  };

  const updateLine = (index: number, updates: Partial<ReservationLine>) => {
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
    if (!borrowerName.trim()) {
      setError("Enter who this reservation is for.");
      return;
    }
    if (!start) {
      setError("Choose a start date/time.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const startAt = new Date(start).toISOString();
    const endAt = end ? new Date(end).toISOString() : null;

    const base = {
      borrower_name: borrowerName.trim(),
      club_name: clubName.trim() || null,
      event_name: eventName.trim() || null,
      start_at: startAt,
      end_at: endAt,
      status,
      notes: notes || null,
    };

    const rows: any[] = [];
    for (const line of lines) {
      rows.push({
        ...base,
        item_id: line.itemId,
        bin_id: null,
        quantity: line.quantity || null,
      });
    }
    if (selectedBinId) {
      rows.push({
        ...base,
        item_id: null,
        bin_id: selectedBinId,
        quantity: null,
      });
    }

    const { error: insertError, data } = await supabase
      .from("reservations")
      .insert(rows)
      .select("id")
      .limit(1);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      userId: null,
      action: "reservation_created",
      entityType: "item",
      details: {
        reservation_any_id: (data as any)?.[0]?.id,
        items_count: lines.length,
        bin_id: selectedBinId || null,
        borrower_name: borrowerName.trim(),
        club_name: clubName.trim() || null,
        start_at: startAt,
        end_at: endAt,
        status,
      },
    });

    router.push("/schedule");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          New reservation
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Block off items for a club or event before the actual checkout.
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

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              What are you reserving?
            </h2>
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
              Add one or more items, or choose a bin below (or both).
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
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, {
                      quantity: Number(e.target.value) || 1,
                    })
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
              Or reserve an entire bin (optional)
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
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Who is this for?
            </label>
            <input
              type="text"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Person name"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Club (optional)
            </label>
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Club name"
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Event (optional)
          </label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Event name"
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Start
            </label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              End (optional)
            </label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700">
            Status
          </label>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setStatus("planned")}
              className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                status === "planned"
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              Planned
            </button>
            <button
              type="button"
              onClick={() => setStatus("confirmed")}
              className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                status === "confirmed"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              Confirmed
            </button>
          </div>
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
            {saving ? "Saving..." : "Save reservation"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push("/schedule")}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

