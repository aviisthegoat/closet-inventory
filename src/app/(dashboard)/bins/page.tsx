"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { BinForm } from "@/components/forms/BinForm";

type BinRow = {
  id: string;
  label: string;
  location_id: string | null;
  location_name: string | null;
  notes: string | null;
  photo_url: string | null;
};

export default function BinsPage() {
  const [bins, setBins] = useState<BinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBin, setShowNewBin] = useState(false);
  const [editBinId, setEditBinId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<{
    label: string;
    location_id: string | null;
    notes: string | null;
  } | null>(null);
  const searchParams = useSearchParams();

  const loadBins = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("bins")
      .select("id, label, notes, photo_url, location_id, locations(name)")
      .order("label", { ascending: true });

    const mapped =
      data?.map((b: any) => ({
        id: b.id,
        label: b.label,
        location_id: b.location_id ?? null,
        notes: b.notes,
        photo_url: b.photo_url ?? null,
        location_name: b.locations?.name ?? null,
      })) ?? [];

    setBins(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadBins();
  }, []);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const bin = bins.find((b) => b.id === editId);
    if (bin) {
      setEditBinId(bin.id);
      setEditInitial({
        label: bin.label,
        location_id: bin.location_id,
        notes: bin.notes,
      });
    } else {
      createSupabaseBrowserClient()
        .from("bins")
        .select("id, label, location_id, notes")
        .eq("id", editId)
        .single()
        .then(({ data: b }) => {
          if (b) {
            setEditBinId(b.id);
            setEditInitial({
              label: b.label,
              location_id: b.location_id ?? null,
              notes: b.notes ?? null,
            });
          }
        });
    }
  }, [searchParams, bins]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Bins
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            All labeled boxes and containers in the closet.
          </p>
        </div>
        <button
          onClick={() => setShowNewBin(true)}
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          + Add bin
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {loading ? (
          <p className="text-xs text-zinc-500">Loading bins…</p>
        ) : bins.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No bins yet. Start by adding the main boxes on each shelf.
          </p>
        ) : (
          bins.map((bin) => (
            <div
              key={bin.id}
              className="flex flex-col justify-between rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex gap-3">
                {bin.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bin.photo_url}
                    alt={bin.label}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {bin.label}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {bin.location_name ?? "Unassigned location"}
                  </p>
                </div>
              </div>
              {bin.notes && (
                <p className="mt-3 line-clamp-3 text-xs text-zinc-500">
                  {bin.notes}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <a
                  href={`/bins/${bin.id}`}
                  className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-white hover:bg-zinc-800"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setEditBinId(bin.id);
                    setEditInitial({
                      label: bin.label,
                      location_id: bin.location_id,
                      notes: bin.notes,
                    });
                  }}
                  className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  Edit
                </button>
                <a
                  href={`/qr/generate?binId=${bin.id}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  QR code
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {showNewBin && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Add a new bin</h2>
              <button
                onClick={() => setShowNewBin(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <BinForm
              onCreated={async () => {
                setShowNewBin(false);
                await loadBins();
              }}
            />
          </div>
        </div>
      )}

      {editBinId && editInitial && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Edit bin</h2>
              <button
                onClick={() => { setEditBinId(null); setEditInitial(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <BinForm
              mode="edit"
              binId={editBinId}
              initialData={editInitial}
              onSaved={async () => {
                setEditBinId(null);
                setEditInitial(null);
                await loadBins();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

