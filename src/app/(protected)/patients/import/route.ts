import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/authorization";
import { ImportError, importPatients } from "@/server/patients/import";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  // Same-origin only (the session cookie is SameSite, this is a second check).
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a file to import." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File is too large (max 10 MB)." }, { status: 400 });
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    return Response.json({ error: "Use an .xlsx or .csv file." }, { status: 400 });
  }

  try {
    const report = await importPatients(
      { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
      userId,
    );
    revalidatePath("/patients");
    return Response.json(report);
  } catch (e) {
    if (e instanceof ImportError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
