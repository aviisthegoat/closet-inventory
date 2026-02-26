"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ActiveCheckout = {
  id: string;
  borrower_name: string;
  club_name: string | null;
  event_name: string | null;
  notes?: string | null;
};

export function ActiveCheckoutsList({ initial }: { initial: ActiveCheckout[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const checkIn = async (id: string) => {
    setBusyId(id);
    router.push(`/checkouts?group=${id}`);
  };

  if (!initial || initial.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No active checkouts right now.</p>
    );
  }

  return (
    <div className="space-y-2">
      {initial.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900">
              {c.borrower_name} {c.club_name ? `· ${c.club_name}` : ""}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {c.event_name ?? "Event / use not specified"}
            </p>
            {c.notes && (
              <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                {c.notes}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => checkIn(c.id)}
            disabled={busyId === c.id}
            className="shrink-0 rounded-2xl bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busyId === c.id ? "Checking in..." : "Check in"}
          </button>
        </div>
      ))}
    </div>
  );
}

