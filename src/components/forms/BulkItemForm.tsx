"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type BinOption = { id: string; label: string; locationName: string | null };
type GroupOption = { id: string; name: string };
type LocationOption = { id: string; name: string };

type BulkItemFormProps = {
  onCreated?: () => void;
};

type BulkLine = {
  item_group_id: string;
  new_group_name: string;
  bin_id: string;
  location_id: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number | "";
  expiry_date: string;
};

export function BulkItemForm({ onCreated }: BulkItemFormProps) {
  const [bins, setBins] = useState<BinOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [lines, setLines] = useState<BulkLine[]>([
    {
      item_group_id: "",
      new_group_name: "",
      bin_id: "",
      location_id: "",
      quantity: 1,
      unit: "pcs",
      low_stock_threshold: "",
      expiry_date: "",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [binsRes, groupsRes, locationsRes] = await Promise.all([
        supabase
          .from("bins")
          .select("id, label, locations(name)")
          .order("label", { ascending: true }),
        supabase
          .from("item_groups")
          .select("id, name")
          .order("name", { ascending: true }),
        supabase
          .from("locations")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);
      setBins(
        (binsRes.data ?? []).map((b: any) => ({
          id: b.id as string,
          label: b.label as string,
          locationName: (b.locations?.name as string | null) ?? null,
        })),
      );
      setGroups(
        (groupsRes.data ?? []).map((g: any) => ({
          id: g.id as string,
          name: g.name as string,
        })),
      );
      setLocations(
        (locationsRes.data ?? []).map((l: any) => ({
          id: l.id as string,
          name: l.name as string,
        })),
      );
    };
    load();
  }, []);

  const updateLine = (index: number, patch: Partial<BulkLine>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      // If a bin is chosen, clear location so there is no conflict
      if (patch.bin_id !== undefined && patch.bin_id) {
        next[index].location_id = "";
      }
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        item_group_id: "",
        new_group_name: "",
        bin_id: "",
        location_id: "",
        quantity: 1,
        unit: "pcs",
        low_stock_threshold: "",
        expiry_date: "",
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const nonEmptyLines = lines.filter(
      (line) =>
        (line.item_group_id || line.new_group_name.trim()) &&
        line.quantity > 0,
    );

    if (nonEmptyLines.length === 0) {
      setError("Add at least one valid item line with an item type.");
      setSaving(false);
      return;
    }

    const resolvedPayload: any[] = [];
    const groupCache = new Map<string, string>(); // lowercased name -> id

    for (const line of nonEmptyLines) {
      let resolvedGroupId = line.item_group_id;
      const nameFromSelect =
        groups.find((g) => g.id === line.item_group_id)?.name ?? "";
      const nameToUse = line.new_group_name.trim() || nameFromSelect;

      if (!resolvedGroupId || line.new_group_name.trim()) {
        if (!nameToUse) {
          setError("Each line must have an item type selected or typed.");
          setSaving(false);
          return;
        }

        const cacheKey = nameToUse.toLowerCase();
        if (groupCache.has(cacheKey)) {
          resolvedGroupId = groupCache.get(cacheKey)!;
        } else {
          const { data: existing } = await supabase
            .from("item_groups")
            .select("id")
            .ilike("name", nameToUse)
            .maybeSingle();
          if (existing?.id) {
            resolvedGroupId = existing.id as string;
          } else {
            const { data: created, error: ge } = await supabase
              .from("item_groups")
              .insert({ name: nameToUse })
              .select("id")
              .single();
            if (ge || !created) {
              setError(ge?.message ?? "Could not create item type.");
              setSaving(false);
              return;
            }
            resolvedGroupId = created.id as string;
          }
          groupCache.set(cacheKey, resolvedGroupId);
        }
      }

      if (!resolvedGroupId) {
        setError("Each line must have an item type.");
        setSaving(false);
        return;
      }

      resolvedPayload.push({
        item_group_id: resolvedGroupId,
        bin_id: line.bin_id || null,
        location_id: line.bin_id ? null : line.location_id || null,
        quantity_on_hand: line.quantity,
        unit: line.unit || "pcs",
        low_stock_threshold:
          line.low_stock_threshold === ""
            ? null
            : Number(line.low_stock_threshold),
        expiry_date: line.expiry_date
          ? new Date(`${line.expiry_date}T00:00:00.000Z`).toISOString()
          : null,
        notes: null,
      });
    }

    const { error: insertErr } = await supabase
      .from("items")
      .insert(resolvedPayload);

    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setLines([
      {
        item_group_id: "",
        new_group_name: "",
        bin_id: "",
        location_id: "",
        quantity: 1,
        unit: "pcs",
        low_stock_threshold: "",
        expiry_date: "",
      },
    ]);
    onCreated?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <p className="text-xs text-zinc-500">
        Quickly add several items at once. Pick an existing item type or type a
        new one for each row.
      </p>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {lines.map((line, index) => (
          <div
            key={index}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-zinc-700">
                Item {index + 1}
              </p>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-800"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Item type
              </label>
              <select
                value={line.item_group_id}
                onChange={(e) =>
                  updateLine(index, { item_group_id: e.target.value })
                }
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">Choose existing type</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                value={line.new_group_name}
                onChange={(e) =>
                  updateLine(index, { new_group_name: e.target.value })
                }
                placeholder="Or type new type (e.g. Christmas lights)"
                className="mt-1 block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Bin (optional)
              </label>
              <select
                value={line.bin_id}
                onChange={(e) => updateLine(index, { bin_id: e.target.value })}
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">No bin</option>
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.locationName ? ` · ${b.locationName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Location (for items not in bins)
              </label>
              <select
                value={line.location_id}
                onChange={(e) =>
                  updateLine(index, { location_id: e.target.value })
                }
                disabled={!!line.bin_id}
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 disabled:opacity-50"
              >
                <option value="">No location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="block text-[11px] font-medium text-zinc-700">
                  Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, {
                      quantity: Number(e.target.value) || 0,
                    })
                  }
                  className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="w-20 space-y-1">
                <label className="block text-[11px] font-medium text-zinc-700">
                  Unit
                </label>
                <input
                  value={line.unit}
                  onChange={(e) =>
                    updateLine(index, { unit: e.target.value || "pcs" })
                  }
                  className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Low stock threshold (optional)
              </label>
              <input
                type="number"
                min={0}
                value={line.low_stock_threshold}
                onChange={(e) =>
                  updateLine(index, {
                    low_stock_threshold:
                      e.target.value === ""
                        ? ""
                        : Number(e.target.value) || 0,
                  })
                }
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Expiry date (optional)
              </label>
              <input
                type="date"
                value={line.expiry_date}
                onChange={(e) =>
                  updateLine(index, { expiry_date: e.target.value })
                }
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={addLine}
          className="rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Add another line
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save all items"}
        </button>
      </div>
    </form>
  );
}

