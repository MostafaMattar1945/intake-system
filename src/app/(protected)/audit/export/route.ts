import { requireAdmin } from "@/server/auth/authorization";
import { logAudit } from "@/server/audit/services";
import { listAllAuditLogsForExport } from "@/server/audit/queries";
import ExcelJS from "exceljs";

export async function GET() {
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

  const logs = await listAllAuditLogsForExport();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit Log");
  sheet.columns = [
    { header: "Time (UTC)", key: "createdAt", width: 20 },
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
      createdAt: log.createdAt.toISOString(),
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
    metadata: { rows: logs.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
