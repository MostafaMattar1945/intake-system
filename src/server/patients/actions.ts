"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { newPatientSchema } from "@/lib/validation/patient";
import { requireAdminOrRedirect } from "@/server/auth/authorization";
import { requireUserOrRedirect } from "@/server/auth/require-user-or-redirect";
import {
  createPatient,
  deletePatient,
  findDuplicate,
  updatePatient,
} from "@/server/patients/services";

export type PatientActionState =
  | { ok: true; message: string }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string>;
      duplicate?: { name: string };
    }
  | null;

const FIELDS = [
  "patientName",
  "phone1",
  "phone2",
  "provider",
  "appointmentDate",
  "assignedToId",
  "status",
  "source",
  "scheduledReason",
  "notes",
  "receivedDate",
  "scheduledDate",
  "referringFacility",
  "facilityAgentId",
] as const;

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function toObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIELDS) out[key] = formString(formData, key);
  return out;
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export async function savePatientAction(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const { user } = await requireUserOrRedirect();

  const parsed = newPatientSchema.safeParse(toObject(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // The duplicate is looked up on the server; the client only sends its choice.
  const choice = formString(formData, "duplicateAction");
  const duplicate = await findDuplicate(parsed.data.patientName);

  if (duplicate && choice !== "update" && choice !== "anyway") {
    return {
      ok: false,
      error: "A patient with this name already exists.",
      duplicate: { name: duplicate.patientName },
    };
  }

  if (duplicate && choice === "update") {
    const updated = await updatePatient(duplicate.id, parsed.data);
    if (!updated.ok) return { ok: false, error: updated.error };
    revalidatePath("/patients");
    return { ok: true, message: "Existing record updated." };
  }

  const created = await createPatient(parsed.data, user.id);
  if (!created.ok) return { ok: false, error: created.error };

  revalidatePath("/patients");
  return { ok: true, message: "Patient saved. Ready for the next one." };
}

export async function updatePatientAction(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  await requireUserOrRedirect();

  const patientId = formString(formData, "patientId").trim();
  if (!patientId) return { ok: false, error: "Invalid input" };

  const parsed = newPatientSchema.safeParse(toObject(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const updated = await updatePatient(patientId, parsed.data);
  if (!updated.ok) return { ok: false, error: updated.error };

  revalidatePath("/patients");
  return { ok: true, message: "Changes saved." };
}

export async function deletePatientAction(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  await requireAdminOrRedirect();

  const patientId = formString(formData, "patientId").trim();
  if (!patientId) return { ok: false, error: "Invalid input" };

  const deleted = await deletePatient(patientId);
  if (!deleted.ok) return { ok: false, error: deleted.error };

  revalidatePath("/patients");
  return { ok: true, message: "Deleted." };
}
