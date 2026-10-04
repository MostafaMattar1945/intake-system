import { requireAdminOrRedirect } from "@/server/auth/authorization";
import { listAuditLogs } from "@/server/audit/queries";
import Link from "next/link";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminOrRedirect();

  const { page: rawPage } = await searchParams;
  const { rows, total, page, pageCount } = await listAuditLogs(rawPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Audit Log</h1>
        <Link
          href="/audit/export"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-900/90 h-9 px-4 py-2"
        >
          Export to Excel
        </Link>
      </div>

      <div className="rounded-md border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Timestamp (UTC)</th>
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
                    {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
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
          <Link href={`/audit?page=${page - 1}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-100 h-9 px-4 py-2">
            Previous
          </Link>
        )}
        <span className="text-sm text-zinc-600">Page {page} of {pageCount} (Total: {total})</span>
        {page < pageCount && (
          <Link href={`/audit?page=${page + 1}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-100 h-9 px-4 py-2">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
