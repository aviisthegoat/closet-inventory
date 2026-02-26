"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type LocationOption = { id: string; name: string };

type BinFormProps = {
  defaultLocationId?: string;
  onCreated?: () => void;
  mode?: "add" | "edit";
  binId?: string;
  initialData?: { label: string; location_id: string | null; notes: string | null };
  onSaved?: () => void;
};

export function BinForm({
  defaultLocationId,
  onCreated,
  mode = "add",
  binId,
  initialData,
  onSaved,
}: BinFormProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [label, setLabel] = useState(initialData?.label ?? "");
  const [locationId, setLocationId] = useState(initialData?.location_id ?? defaultLocationId ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("locations")
        .select("id, name")
        .order("sort_order", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true });
      setLocations((data ?? []).map((r: any) => ({ id: r.id, name: r.name })));
    };
    load();
  }, []);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setLabel(initialData.label);
      setLocationId(initialData.location_id ?? "");
      setNotes(initialData.notes ?? "");
    } else if (defaultLocationId) {
      setLocationId(defaultLocationId);
    }
  }, [mode, initialData, defaultLocationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    if (mode === "edit" && binId) {
      const { error: updateErr } = await supabase
        .from("bins")
        .update({
          label,
          location_id: locationId || null,
          notes: notes || null,
        })
        .eq("id", binId);
      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      await logActivity(supabase, {
        userId: null,
        action: "bin_updated",
        entityType: "bin",
        entityId: binId,
        details: { label, location_id: locationId || null },
      });

      onSaved?.();
      setSaving(false);
      return;
    }

    const { data: createdBin, error: insertError } = await supabase
      .from("bins")
      .insert({
        label,
        location_id: locationId || null,
        notes: notes || null,
      })
      .select("id")
      .single();
    if (insertError || !createdBin) {
      setError(insertError?.message ?? "Could not create bin.");
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      userId: null,
      action: "bin_created",
      entityType: "bin",
      entityId: createdBin.id,
      details: { label, location_id: locationId || null },
    });

    setLabel("");
    setLocationId(defaultLocationId ?? "");
    setNotes("");
    setSaving(false);
    onCreated?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Bin label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          placeholder="e.g. Christmas decor · Shelf A2"
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Location (shelf / zone)</label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        >
          <option value="">No location</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Add bin"}
      </button>
    </form>
  );
}
