"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import type { Source, Status } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/server/audit/services";
import { newPatientSchema } from "@/lib/validation/patient";
import type { NewPatientData } from "@/lib/validation/patient";
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

type OldPatientAuditRow = {
  patientName: string;
  phone1: string;
  phone2: string | null;
  provider: string | null;
  appointmentDate: Date | null;
  assignedToId: string;
  status: Status;
  source: Source;
  scheduledReason: string;
  notes: string | null;
  receivedDate: Date | null;
  scheduledDate: Date | null;
  referringFacility: string | null;
  facilityAgentId: string | null;
};

function dayKey(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function datesEqual(a: Date | null, b: Date | null): boolean {
  return dayKey(a) === dayKey(b);
}

async function getOldPatientAuditRow(
  patientId: string,
): Promise<OldPatientAuditRow | null> {
  return prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      patientName: true,
      phone1: true,
      phone2: true,
      provider: true,
      appointmentDate: true,
      assignedToId: true,
      status: true,
      source: true,
      scheduledReason: true,
      notes: true,
      receivedDate: true,
      scheduledDate: true,
      referringFacility: true,
      facilityAgentId: true,
    },
  });
}

function computeChangedFields(oldRow: OldPatientAuditRow, next: NewPatientData): string {
  const changed: string[] = [];

  if (oldRow.patientName !== next.patientName) changed.push("patientName");
  if (oldRow.phone1 !== next.phone1) changed.push("phone1");
  if ((oldRow.phone2 ?? null) !== (next.phone2 ?? null)) changed.push("phone2");
  if ((oldRow.provider ?? null) !== (next.provider ?? null)) changed.push("provider");

  if (!datesEqual(oldRow.appointmentDate, next.appointmentDate)) {
    changed.push("appointmentDate");
  }

  if (oldRow.assignedToId !== next.assignedToId) changed.push("assignedToId");
  if (oldRow.status !== next.status) changed.push("status");
  if (oldRow.source !== next.source) changed.push("source");
  if (oldRow.scheduledReason !== next.scheduledReason) {
    changed.push("scheduledReason");
  }

  if ((oldRow.notes ?? null) !== (next.notes ?? null)) changed.push("notes");

  if (!datesEqual(oldRow.receivedDate, next.receivedDate)) {
    changed.push("receivedDate");
  }

  if (!datesEqual(oldRow.scheduledDate, next.scheduledDate)) {
    changed.push("scheduledDate");
  }

  if (
    (oldRow.referringFacility ?? null) !== (next.referringFacility ?? null)
  ) {
    changed.push("referringFacility");
  }

  if (
    (oldRow.facilityAgentId ?? null) !== (next.facilityAgentId ?? null)
  ) {
    changed.push("facilityAgentId");
  }

  return changed.join(",");
}

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
    const oldRow = await getOldPatientAuditRow(duplicate.id);
    const changedFields = oldRow
      ? computeChangedFields(oldRow, parsed.data)
      : "";

    const updated = await updatePatient(duplicate.id, parsed.data);
    if (!updated.ok) return { ok: false, error: updated.error };

    if (changedFields) {
      await logAudit({
        action: "EDIT",
        actorUserId: user.id,
        entityType: "Patient",
        entityId: duplicate.id,
        metadata: { changedFields },
      });
    }

    revalidatePath("/patients");
    return { ok: true, message: "Existing record updated." };
  }

  const auditOp =
    duplicate && choice === "anyway" ? "create_duplicate_override" : "create";

  const created = await createPatient(parsed.data, user.id, auditOp);
  if (!created.ok) return { ok: false, error: created.error };

  revalidatePath("/patients");
  return { ok: true, message: "Patient saved. Ready for the next one." };
}

export async function updatePatientAction(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const { user } = await requireUserOrRedirect();

  const patientId = formString(formData, "patientId").trim();
  if (!patientId) return { ok: false, error: "Invalid input" };

  const parsed = newPatientSchema.safeParse(toObject(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const oldRow = await getOldPatientAuditRow(patientId);
  const changedFields = oldRow ? computeChangedFields(oldRow, parsed.data) : "";

  const updated = await updatePatient(patientId, parsed.data);
  if (!updated.ok) return { ok: false, error: updated.error };

  if (changedFields) {
    await logAudit({
      action: "EDIT",
      actorUserId: user.id,
      entityType: "Patient",
      entityId: patientId,
      metadata: { changedFields },
    });
  }

  revalidatePath("/patients");
  return { ok: true, message: "Changes saved." };
}

export async function deletePatientAction(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const { user } = await requireAdminOrRedirect();

  const patientId = formString(formData, "patientId").trim();
  if (!patientId) return { ok: false, error: "Invalid input" };

  const deleted = await deletePatient(patientId);
  if (!deleted.ok) return { ok: false, error: deleted.error };

  await logAudit({
    action: "DELETE",
    actorUserId: user.id,
    entityType: "Patient",
    entityId: patientId,
    metadata: { op: "delete" },
  });

  revalidatePath("/patients");
  return { ok: true, message: "Deleted." };
}
