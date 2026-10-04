import { requireUser } from "@/server/auth/authorization";
import { buildPatientsWorkbook } from "@/server/patients/export";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401 });
    }
    throw e;
  }

  const { buffer } = await buildPatientsWorkbook();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="patients-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
