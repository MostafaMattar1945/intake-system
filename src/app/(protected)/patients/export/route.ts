import { requireUser } from "@/server/auth/authorization";
import { logAudit } from "@/server/audit/services";
import { buildPatientsWorkbook } from "@/server/patients/export";
import { formatDayInZone } from "@/lib/time";

export async function GET() {
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401 });
    }
    throw e;
  }

  const { buffer, rowCount } = await buildPatientsWorkbook();
  const stamp = formatDayInZone(new Date());

  await logAudit({
    action: "EXPORT",
    actorUserId: userId,
    entityType: "Patient",
    metadata: { rows: rowCount },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="patients-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
