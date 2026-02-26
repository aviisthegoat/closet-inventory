import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export default async function LogsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, created_at, details")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Activity log
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Recent changes across locations, bins, items, and checkouts.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                When
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Entity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs && logs.length > 0 ? (
              logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-800">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {log.entity_type}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-xs text-zinc-500"
                >
                  No activity logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

