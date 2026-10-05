import { requireUser } from "@/server/auth/authorization";
import { logAudit } from "@/server/audit/services";
import { buildPatientsWorkbook, parseCalendarDay } from "@/server/patients/export";
import { formatDayInZone } from "@/lib/time";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401 });
    }
    throw e;
  }

  // Received Date range: plain calendar days (YYYY-MM-DD). Invalid or empty values are ignored.
  const params = new URL(request.url).searchParams;
  const fromRaw = params.get("from") ?? "";
  const toRaw = params.get("to") ?? "";
  const from = parseCalendarDay(fromRaw);
  const to = parseCalendarDay(toRaw);
  const fromText = from ? fromRaw : "";
  const toText = to ? toRaw : "";

  if (from && to && from.getTime() > to.getTime()) {
    return Response.json(
      { error: "From date must be on or before To date." },
      { status: 400 },
    );
  }

  const { buffer, rowCount } = await buildPatientsWorkbook({ from, to });
  const stamp = formatDayInZone(new Date());
  const filename =
    fromText || toText
      ? `patients-${fromText || "all"}_${toText || stamp}.xlsx`
      : `patients-${stamp}.xlsx`;

  await logAudit({
    action: "EXPORT",
    actorUserId: userId,
    entityType: "Patient",
    metadata: { rows: rowCount, from: fromText || null, to: toText || null },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
