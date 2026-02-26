"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

export type LineStatus = "ok" | "lost" | "broken" | "used";

export type CheckoutLine = {
  id: string;
  label: string;
  quantity: number | null;
  item_id: string | null;
  status: "checked_out" | "returned" | "lost";
  issue_type: "lost" | "broken" | null;
};

export type CheckoutGroup = {
  id: string; // batch id (or single-row id)
  borrower_name: string;
  club_name: string | null;
  event_name: string | null;
  notes: string | null;
  status: "checked_out" | "returned" | "lost";
  due_back_at: string | null;
  checked_out_at: string | null;
  lines: CheckoutLine[];
};

export function CheckoutsClient({ initialGroups }: { initialGroups: CheckoutGroup[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkouts, setCheckouts] = useState<CheckoutGroup[]>(initialGroups);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [checkinGroupId, setCheckinGroupId] = useState<string | null>(null);
  const [checkinLines, setCheckinLines] = useState<
    {
      id: string;
      label: string;
      quantity: number | null;
      itemId: string | null;
      okQty: number;
      lostQty: number;
      brokenQty: number;
      usedQty: number;
      choice: LineStatus;
    }[]
  >([]);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [checkinSaving, setCheckinSaving] = useState(false);

  const openCheckin = (group: CheckoutGroup) => {
    setCheckinGroupId(group.id);
    setCheckinNotes("");
    setCheckinLines(
      group.lines.map((l) => ({
        id: l.id,
        label:
          (l.quantity != null ? `${l.quantity} × ` : "") +
          (l.label || "Item / bin"),
        quantity: l.quantity,
        itemId: l.item_id,
        okQty: l.quantity && l.quantity > 0 ? l.quantity : 0,
        lostQty: 0,
        brokenQty: 0,
        usedQty: 0,
        choice:
          l.issue_type === "lost" || l.issue_type === "broken"
            ? (l.issue_type as LineStatus)
            : "ok",
      })),
    );
  };

  const setLineChoice = (lineId: string, choice: LineStatus) => {
    setCheckinLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, choice } : l)),
    );
  };

  const setLineQuantities = (
    lineId: string,
    patch: Partial<{
      okQty: number;
      lostQty: number;
      brokenQty: number;
      usedQty: number;
    }>,
  ) => {
    setCheckinLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    );
  };

  const confirmCheckin = async () => {
    if (!checkinGroupId || checkinLines.length === 0) return;
    setCheckinSaving(true);
    const supabase = createSupabaseBrowserClient();
    const trimmedNotes = checkinNotes.trim();
    const now = new Date().toISOString();

    // First validate quantities
    for (const line of checkinLines) {
      if (line.quantity && line.quantity > 0) {
        const total =
          (line.okQty || 0) +
          (line.lostQty || 0) +
          (line.brokenQty || 0) +
          (line.usedQty || 0);
        if (total !== line.quantity) {
          // eslint-disable-next-line no-alert
          alert(
            `For "${line.label}", the totals must add up to ${line.quantity}.`,
          );
          setCheckinSaving(false);
          return;
        }
      }
    }

    for (const line of checkinLines) {
      let status: "returned" | "lost" = "returned";
      let issue_type: "lost" | "broken" | null = null;
      let summary = "";

      if (line.quantity && line.quantity > 0) {
        const lost = line.lostQty || 0;
        const broken = line.brokenQty || 0;
        const used = line.usedQty || 0;

        if (lost > 0 || broken > 0) {
          issue_type = broken > 0 ? "broken" : "lost";
        }

        summary = `Returned OK: ${line.okQty || 0}, Lost: ${lost}, Broken: ${broken}, Used: ${used}`;
      } else {
        // No quantity tracked (e.g. whole bin) – use simple status
        status = line.choice === "ok" ? "returned" : "lost";
        issue_type =
          line.choice === "ok" ? null : (line.choice as "lost" | "broken");
      }

      const { data: existing } = await supabase
        .from("checkouts")
        .select("notes, item_id")
        .eq("id", line.id)
        .single();
      const existingNotes = (existing as any)?.notes as
        | string
        | null
        | undefined;

      const breakdownNote =
        summary && line.quantity && line.quantity > 0
          ? `[Check-in] ${summary}${
              trimmedNotes ? ` – ${trimmedNotes}` : ""
            }`
          : trimmedNotes
          ? `[Check-in] ${trimmedNotes}`
          : "";

      const appendedNotes = breakdownNote
        ? `${existingNotes ? `${existingNotes}\n\n` : ""}${breakdownNote}`
        : existingNotes ?? null;

      await supabase
        .from("checkouts")
        .update({
          status,
          checked_in_at: now,
          issue_type,
          notes: appendedNotes,
        })
        .eq("id", line.id);

      // If this line is tied to an item with quantity, reduce stock for
      // anything that was lost, broken, or used so low-stock alerts work.
      if (line.itemId && line.quantity && line.quantity > 0) {
        const consumed =
          (line.lostQty || 0) + (line.brokenQty || 0) + (line.usedQty || 0);
        if (consumed > 0) {
          const { data: item } = await supabase
            .from("items")
            .select("quantity_on_hand")
            .eq("id", line.itemId)
            .single();
          const currentQty = Number(
            (item as any)?.quantity_on_hand ?? 0,
          );
          const newQty = Math.max(0, currentQty - consumed);
          await supabase
            .from("items")
            .update({ quantity_on_hand: newQty })
            .eq("id", line.itemId);
        }
      }

      await logActivity(supabase, {
        userId: null,
        action: "checkout_checked_in",
        entityType: "checkout",
        entityId: line.id,
        details: {
          status,
          issue_type,
          notes: trimmedNotes || null,
        },
      });
    }

    setCheckinSaving(false);
    setCheckinGroupId(null);
    setCheckinLines([]);
    setCheckinNotes("");

    // Refresh from the server so dashboard & history stay in sync
    router.refresh();
  };

  // If navigated from the dashboard with ?group=<id>, open that checkout's
  // detailed check-in modal automatically.
  useEffect(() => {
    const groupId = searchParams.get("group");
    if (!groupId) return;
    const group = checkouts.find((g) => g.id === groupId);
    if (!group) return;
    openCheckin(group);
    // Strip the query param so closing the modal doesn't immediately reopen it
    router.replace("/checkouts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, checkouts]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Checkouts
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            See what&apos;s currently out and your full borrowing history.
          </p>
        </div>
        <a
          href="/checkout/new"
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          + New checkout
        </a>
      </header>

      <div className="flex items-center justify-between text-xs text-zinc-600">
        <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 font-medium">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-2xl px-3 py-1.5 ${
              filter === "active" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-2xl px-3 py-1.5 ${
              filter === "all" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            All
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          {checkouts.filter((g) =>
            filter === "active"
              ? g.lines.some((l) => l.status === "checked_out")
              : true,
          ).length}{" "}
          {filter === "active" ? "active" : "total"} records
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Borrower
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Item / Bin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Due back
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {checkouts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-xs text-zinc-500"
                >
                  No checkouts found yet.
                </td>
              </tr>
            ) : (
              checkouts
                .filter((g) =>
                  filter === "active"
                    ? g.lines.some((l) => l.status === "checked_out")
                    : true,
                )
                .map((c) => {
                  const due =
                    c.due_back_at &&
                    new Date(c.due_back_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  const isLate =
                    c.lines.some((l) => l.status === "checked_out") &&
                    c.due_back_at &&
                    new Date(c.due_back_at) < new Date();

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">
                            {c.borrower_name}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {c.club_name ?? "No club specified"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">
                            {c.lines.length === 1
                              ? c.lines[0].label
                              : `${c.lines.length} items/bins`}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {c.event_name ?? "Event not specified"}
                          </span>
                          {c.notes && (
                            <span className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                              {c.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {due ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isLate
                                ? "bg-rose-100 text-rose-800"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {due}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            No date
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            c.lines.some((l) => l.status === "checked_out")
                              ? "bg-sky-100 text-sky-800"
                              : c.lines.some((l) => l.issue_type)
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {c.lines.some((l) => l.status === "checked_out")
                            ? "checked out"
                            : c.lines.some((l) => l.issue_type)
                            ? "issue"
                            : "returned"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {c.lines.some((l) => l.status === "checked_out") && (
                          <button
                            type="button"
                            onClick={() => openCheckin(c)}
                            className="rounded-2xl bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-zinc-800"
                          >
                            Check in
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>

      {checkinGroupId && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Check in checkout
              </h2>
              <button
                onClick={() => {
                  if (checkinSaving) return;
                  setCheckinGroupId(null);
                  setCheckinLines([]);
                  setCheckinNotes("");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-700">
                  For each line, choose what happened
                </label>
                <div className="space-y-2">
                  {checkinLines.map((line) =>
                    line.quantity && line.quantity > 0 ? (
                      <div
                        key={line.id}
                        className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <div className="text-[11px] text-zinc-800">
                          {line.label}{" "}
                          <span className="text-zinc-500">
                            (total {line.quantity})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px]">
                          <label className="flex items-center gap-1">
                            <span className="text-zinc-600">
                              Returned OK
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={line.quantity}
                              value={line.okQty}
                              onChange={(e) =>
                                setLineQuantities(line.id, {
                                  okQty: Number(e.target.value) || 0,
                                })
                              }
                              className="w-14 rounded-xl border border-zinc-200 bg-white px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            <span className="text-zinc-600">Lost</span>
                            <input
                              type="number"
                              min={0}
                              max={line.quantity}
                              value={line.lostQty}
                              onChange={(e) =>
                                setLineQuantities(line.id, {
                                  lostQty: Number(e.target.value) || 0,
                                })
                              }
                              className="w-14 rounded-xl border border-zinc-200 bg-white px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            <span className="text-zinc-600">Broken</span>
                            <input
                              type="number"
                              min={0}
                              max={line.quantity}
                              value={line.brokenQty}
                              onChange={(e) =>
                                setLineQuantities(line.id, {
                                  brokenQty: Number(e.target.value) || 0,
                                })
                              }
                              className="w-14 rounded-xl border border-zinc-200 bg-white px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            <span className="text-zinc-600">Used</span>
                            <input
                              type="number"
                              min={0}
                              max={line.quantity}
                              value={line.usedQty}
                              onChange={(e) =>
                                setLineQuantities(line.id, {
                                  usedQty: Number(e.target.value) || 0,
                                })
                              }
                              className="w-14 rounded-xl border border-zinc-200 bg-white px-2 py-1"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={line.id}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <span className="flex-1 text-[11px] text-zinc-800">
                          {line.label}
                        </span>
                        <select
                          value={line.choice}
                          onChange={(e) =>
                            setLineChoice(
                              line.id,
                              e.target.value as LineStatus,
                            )
                          }
                          className="rounded-2xl border border-zinc-200 bg-white px-2 py-1 text-[11px]"
                        >
                          <option value="ok">Returned OK</option>
                          <option value="lost">Lost</option>
                          <option value="broken">Broken</option>
                        </select>
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-medium text-zinc-700">
                  Details (optional)
                </label>
                <textarea
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                  rows={3}
                  className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={checkinSaving}
                  onClick={confirmCheckin}
                  className="rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {checkinSaving ? "Saving..." : "Confirm check in"}
                </button>
                <button
                  type="button"
                  disabled={checkinSaving}
                  onClick={() => {
                    if (checkinSaving) return;
                    setCheckinGroupId(null);
                    setCheckinLines([]);
                    setCheckinNotes("");
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

