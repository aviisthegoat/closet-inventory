"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type TargetOption = {
  id: string;
  label: string;
};

export default function GenerateQrPage() {
  const searchParams = useSearchParams();
  const preselectedBinId = searchParams.get("binId") ?? undefined;
  const [mode, setMode] = useState<"bin" | "item_group">("bin");
  const [bins, setBins] = useState<TargetOption[]>([]);
  const [groups, setGroups] = useState<TargetOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    preselectedBinId,
  );
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [binsRes, groupsRes] = await Promise.all([
        supabase.from("bins").select("id, label").order("label", {
          ascending: true,
        }),
        supabase.from("item_groups").select("id, name").order("name", {
          ascending: true,
        }),
      ]);

      setBins(
        binsRes.data?.map((b: any) => ({ id: b.id, label: b.label })) ?? [],
      );
      setGroups(
        groupsRes.data?.map((g: any) => ({ id: g.id, label: g.name })) ?? [],
      );
    };

    load();
  }, []);

  const handleGenerate = async () => {
    if (!selectedId) return;
    const supabase = createSupabaseBrowserClient();

    const type = mode;

    // Try to find an existing code first
    const { data: existing } = await supabase
      .from("qr_codes")
      .select("code")
      .eq("type", type)
      .eq("target_id", selectedId)
      .maybeSingle();

    if (existing?.code) {
      setCode(existing.code);
      return;
    }

    const generatedCode = crypto.randomUUID();

    const { data: created, error } = await supabase
      .from("qr_codes")
      .insert({
        code: generatedCode,
        type,
        target_id: selectedId,
      })
      .select("code")
      .single();

    if (error || !created) return;
    setCode(created.code);
  };

  const appOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://example.com";
  const qrUrl = code ? `${appOrigin}/qr/${code}` : "";

  const options = mode === "bin" ? bins : groups;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Generate QR code
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create printable QR labels for bins or item groups.
        </p>
      </header>

      <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1 text-xs font-medium text-zinc-700">
        <button
          type="button"
          onClick={() => setMode("bin")}
          className={`flex-1 rounded-2xl px-3 py-1.5 transition ${
            mode === "bin" ? "bg-white shadow-sm text-zinc-900" : ""
          }`}
        >
          Bins
        </button>
        <button
          type="button"
          onClick={() => setMode("item_group")}
          className={`flex-1 rounded-2xl px-3 py-1.5 transition ${
            mode === "item_group" ? "bg-white shadow-sm text-zinc-900" : ""
          }`}
        >
          Item groups
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              {mode === "bin" ? "Bin" : "Item group"}
            </label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || undefined)}
              className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">
                {mode === "bin"
                  ? "Select a bin to label"
                  : "Select an item group to label"}
              </option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedId}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            Generate QR code
          </button>
          <p className="text-xs text-zinc-500">
            Print the QR and tape it to the bin or inside the box lid. Scanning
            it on your phone will jump straight to details.
          </p>
        </div>
        <div className="flex items-center justify-center rounded-3xl bg-zinc-900/95 p-6 text-white shadow-sm">
          {code ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl bg-white p-4">
                <QRCode value={qrUrl} size={180} />
              </div>
              <div className="text-center text-xs">
                <p className="font-medium">Scan to open</p>
                <p className="mt-1 break-all text-zinc-300">{qrUrl}</p>
              </div>
            </div>
          ) : (
            <p className="max-w-xs text-center text-xs text-zinc-200">
              Choose a bin or item group and generate a QR code to preview it
              here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

