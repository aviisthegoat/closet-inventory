"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type LocationRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  photo_url: string | null;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadLocations = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("locations")
      .select("id, name, description, sort_order, photo_url")
      .order("sort_order", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    setLocations((data as LocationRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data: created, error } = await supabase
      .from("locations")
      .insert({
        name,
        description: description || null,
      })
      .select("id")
      .single();

    if (!error && created?.id) {
      await logActivity(supabase, {
        userId: null,
        action: "location_created",
        entityType: "location",
        entityId: created.id,
        details: { name, description: description || null },
      });
    }
    setName("");
    setDescription("");
    await loadLocations();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Closet map locations
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Define shelves, zones, and floor areas to power the visual map.
        </p>
      </header>

      <form
        onSubmit={handleAddLocation}
        className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 md:flex-row"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Location name (e.g. Shelf A, Floor back-left)"
          className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
        <button
          type="submit"
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 md:self-center"
        >
          + Add location
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {loading ? (
          <p className="text-xs text-zinc-500">Loading locations…</p>
        ) : locations.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No locations yet. Start by adding main shelves and floor zones.
          </p>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex items-start gap-3">
                {loc.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loc.photo_url}
                    alt={loc.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {loc.name}
                  </p>
                  {loc.description && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {loc.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

