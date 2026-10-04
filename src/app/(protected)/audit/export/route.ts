import { requireAdmin } from "@/server/auth/authorization";
import { logAudit } from "@/server/audit/services";
import { listAllAuditLogsForExport, parseDateRange, countAuditLogs, EXPORT_LIMIT } from "@/server/audit/queries";
import ExcelJS from "exceljs";
import { formatDateTime, formatDayInZone } from "@/lib/time";

export async function GET(request: Request) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).user.id;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return new Response("Forbidden", { status: 403 });
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));

  const count = await countAuditLogs(range);
  if (count > EXPORT_LIMIT) {
    return Response.json({ error: "Too many entries. Narrow the date range." }, { status: 400 });
  }

  const logs = await listAllAuditLogsForExport(range);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit Log");
  sheet.columns = [
    { header: "Time (California)", key: "createdAt", width: 25 },
    { header: "Actor Name", key: "actorName", width: 20 },
    { header: "Actor Email", key: "actorEmail", width: 30 },
    { header: "Action", key: "action", width: 15 },
    { header: "Entity Type", key: "entityType", width: 20 },
    { header: "Entity ID", key: "entityId", width: 36 },
    { header: "Details", key: "metadata", width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const log of logs) {
    sheet.addRow({
      createdAt: formatDateTime(log.createdAt),
      actorName: log.actorName ?? "deleted user",
      actorEmail: log.actorEmail ?? "deleted user",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? "",
      metadata: JSON.stringify(log.metadata),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await logAudit({
    action: "EXPORT",
    actorUserId: adminId,
    entityType: "AuditLog",
    metadata: {
        rows: logs.length,
        from: range.fromText || null,
        to: range.toText || null
    },
  });

  const fromPart = range.fromText || "all";
  const toPart = range.toText || formatDayInZone(new Date());
  const filename = `audit-log-${fromPart}_${toPart}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
