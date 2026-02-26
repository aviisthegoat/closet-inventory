"use client";

import { useState } from "react";

export type ScheduleRow = {
  id: string;
  borrower_name: string;
  club_name: string | null;
  event_name: string | null;
  quantity: number | null;
  status: "planned" | "confirmed" | "cancelled" | "fulfilled";
  start_at: string | null;
  end_at: string | null;
  item_label: string;
};

type ViewMode = "date" | "club" | "item";

export function ScheduleClient({ initial }: { initial: ScheduleRow[] }) {
  const [view, setView] = useState<ViewMode>("date");

  const rows = initial ?? [];

  const formatDate = (value: string | null) => {
    if (!value) return "No date";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "No date";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const groupBy = (keyFn: (row: ScheduleRow) => string) => {
    const map = new Map<string, ScheduleRow[]>();
    rows.forEach((r) => {
      const key = keyFn(r);
      const list = map.get(key);
      if (list) {
        list.push(r);
      } else {
        map.set(key, [r]);
      }
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  };

  let grouped: [string, ScheduleRow[]][];
  if (view === "club") {
    grouped = groupBy((r) => r.club_name || "No club");
  } else if (view === "item") {
    grouped = groupBy((r) => r.item_label);
  } else {
    grouped = groupBy((r) => formatDate(r.start_at));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Schedule
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Internal booking calendar for clubs: who has reserved what, and when.
          </p>
        </div>
        <a
          href="/schedule/new"
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          + New reservation
        </a>
        <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setView("date")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "date" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By date
          </button>
          <button
            type="button"
            onClick={() => setView("club")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "club" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By club
          </button>
          <button
            type="button"
            onClick={() => setView("item")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "item" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By item
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No reservations recorded yet.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([groupLabel, groupRows]) => (
            <section key={groupLabel} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {groupLabel}
              </h2>
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
                <table className="min-w-full divide-y divide-zinc-100 text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Item / Bin
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Club / Borrower
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        When
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {groupRows.map((r) => {
                      const start = r.start_at
                        ? formatDate(r.start_at)
                        : null;
                      const end = r.end_at
                        ? formatDate(r.end_at)
                        : null;
                      return (
                        <tr key={r.id} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900">
                                {r.item_label}
                              </span>
                              {r.quantity != null && (
                                <span className="text-[11px] text-zinc-500">
                                  {r.quantity}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900">
                                {r.borrower_name}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {r.club_name || "No club specified"}
                              </span>
                              {r.event_name && (
                                <span className="text-[11px] text-zinc-400">
                                  {r.event_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col text-[11px] text-zinc-600">
                              {start && <span>From: {start}</span>}
                              {end && <span>To: {end}</span>}
                              {!start && !end && (
                                <span className="text-zinc-400">
                                  No dates set
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                r.status === "planned"
                                  ? "bg-sky-100 text-sky-800"
                                  : r.status === "confirmed"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : r.status === "fulfilled"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

