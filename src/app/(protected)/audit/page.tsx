import { requireAdminOrRedirect } from "@/server/auth/authorization";
import { listAuditLogs, parseDateRange } from "@/server/audit/queries";
import { formatDateTime } from "@/lib/time";
import Link from "next/link";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
}) {
  await requireAdminOrRedirect();

  const params = await searchParams;
  const range = parseDateRange(params.from, params.to);
  const { rows, total, page, pageCount } = await listAuditLogs(params.page, range);

  const queryParams = new URLSearchParams();
  if (range.fromText) queryParams.set("from", range.fromText);
  if (range.toText) queryParams.set("to", range.toText);
  const queryStr = queryParams.toString();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Audit Log</h1>
        <a
          href={`/audit/export?${queryStr}`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-900/90 h-9 px-4 py-2"
        >
          Export to Excel
        </a>
      </div>

      <form className="flex gap-4 items-end bg-zinc-50 p-4 rounded-md border border-zinc-200">
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-zinc-700">From</label>
          <input type="date" name="from" id="from" defaultValue={range.fromText} className="border border-zinc-300 rounded-md px-2 py-1 mt-1" />
        </div>
        <div>
          <label htmlFor="to" className="block text-sm font-medium text-zinc-700">To</label>
          <input type="date" name="to" id="to" defaultValue={range.toText} className="border border-zinc-300 rounded-md px-2 py-1 mt-1" />
        </div>
        <button type="submit" className="bg-zinc-900 text-zinc-50 px-4 py-2 rounded-md h-9">Filter</button>
        <Link href="/audit" className="text-sm text-zinc-600 underline h-9 flex items-center">Clear</Link>
      </form>

      <p className="text-sm text-zinc-600">Showing {total} entries (California time)</p>

      <div className="rounded-md border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Time (California)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Metadata</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">{row.action}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">{row.entityType} ({row.entityId})</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">{row.actorName ?? row.actorEmail ?? "deleted user"}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700 max-w-xs break-words">{JSON.stringify(row.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link href={`/audit?page=${page - 1}${queryStr ? `&${queryStr}` : ""}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-100 h-9 px-4 py-2">
            Previous
          </Link>
        )}
        <span className="text-sm text-zinc-600">Page {page} of {pageCount} (Total: {total})</span>
        {page < pageCount && (
          <Link href={`/audit?page=${page + 1}${queryStr ? `&${queryStr}` : ""}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-100 h-9 px-4 py-2">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
