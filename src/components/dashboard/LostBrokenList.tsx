"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type LostBrokenRow = {
  id: string;
  borrower_name: string;
  club_name: string | null;
  event_name: string | null;
  issue_type: "lost" | "broken";
  notes: string | null;
  items?: { item_groups?: { name?: string | null } | null } | null;
  bins?: { label?: string | null } | null;
  issue_resolved?: boolean | null;
};

export function LostBrokenList({ initial }: { initial: LostBrokenRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const dismiss = async (id: string) => {
    setBusyId(id);
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("checkouts")
      .update({ issue_resolved: true })
      .eq("id", id);

    await logActivity(supabase, {
      userId: null,
      action: "issue_resolved",
      entityType: "checkout",
      entityId: id,
      details: {},
    });

    setRows((prev) => prev.filter((r) => r.id !== id));
    setBusyId(null);
    router.refresh();
  };

  if (!rows || rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No lost or broken items recorded.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {rows.map((c) => {
        const label =
          c.items?.item_groups?.name ??
          c.bins?.label ??
          "Item or bin";

        return (
          <div
            key={c.id}
            className="flex items-start justify-between gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2"
          >
            <div>
              <p className="text-[11px] font-medium text-rose-900">
                {label}
              </p>
              <p className="text-[11px] text-rose-800">
                {c.issue_type === "lost" ? "Lost" : "Broken"} ·{" "}
                {c.borrower_name}
                {c.club_name ? ` · ${c.club_name}` : ""}
              </p>
              {c.notes && (
                <p className="mt-1 line-clamp-2 text-[11px] text-rose-700">
                  {c.notes}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(c.id)}
              disabled={busyId === c.id}
              className="ml-2 rounded-full bg-white/60 px-2 py-1 text-[10px] font-medium text-rose-700 hover:bg-white disabled:opacity-50"
              aria-label="Hide this issue from dashboard"
            >
              {busyId === c.id ? "…" : "X"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

