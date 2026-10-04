// Plain functions (no next/* imports) so they can be tested with tsx.
import { Prisma } from "@prisma/client";
import type { Source, Status } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/normalize";
import type { NewPatientData } from "@/lib/validation/patient";

export type PatientRow = {
  id: string;
  patientName: string;
  phone1: string;
  phone2: string | null;
  provider: string | null;
  appointmentDate: string | null;
  assignedToId: string;
  assignedToName: string;
  status: Status;
  source: Source;
  scheduledReason: string;
  notes: string | null;
  receivedDate: string | null;
  scheduledDate: string | null;
  referringFacility: string | null;
  facilityAgentId: string | null;
  facilityAgentName: string | null;
};

type Option = { value: string; label: string };

// Dates are stored as UTC midnight; always render them as UTC.
function day(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const MAX_ROWS = 200;

export async function listPatients(query?: string): Promise<PatientRow[]> {
  const term = query?.trim() ?? "";
  const where: Prisma.PatientWhereInput = term
    ? {
        OR: [
          { patientNameNormalized: { contains: normalizeName(term) } },
          { phone1: { contains: term } },
          { phone2: { contains: term } },
          { provider: { contains: term, mode: "insensitive" } },
          { referringFacility: { contains: term, mode: "insensitive" } },
          { assignedTo: { name: { contains: term, mode: "insensitive" } } },
        ],
      }
    : {};

  const rows = await prisma.patient.findMany({
    where,
    include: {
      assignedTo: { select: { name: true } },
      facilityAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  return rows.map((p) => ({
    id: p.id,
    patientName: p.patientName,
    phone1: p.phone1,
    phone2: p.phone2,
    provider: p.provider,
    appointmentDate: day(p.appointmentDate),
    assignedToId: p.assignedToId,
    assignedToName: p.assignedTo.name,
    status: p.status,
    source: p.source,
    scheduledReason: p.scheduledReason,
    notes: p.notes,
    receivedDate: day(p.receivedDate),
    scheduledDate: day(p.scheduledDate),
    referringFacility: p.referringFacility,
    facilityAgentId: p.facilityAgentId,
    facilityAgentName: p.facilityAgent?.name ?? null,
  }));
}

export async function listAssignableUsers(): Promise<Option[]> {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ value: u.id, label: u.name }));
}

export async function listActiveFacilityAgents(): Promise<Option[]> {
  const agents = await prisma.facilityAgent.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return agents.map((a) => ({ value: a.id, label: a.name }));
}

export async function listProviders(): Promise<string[]> {
  const rows = await prisma.patient.findMany({
    where: { provider: { not: null } },
    select: { provider: true },
    distinct: ["provider"],
    orderBy: { provider: "asc" },
    take: 200,
  });
  return rows.map((r) => r.provider).filter((p): p is string => p !== null);
}

export async function findDuplicate(
  name: string,
  excludeId?: string,
): Promise<{ id: string; patientName: string } | null> {
  return prisma.patient.findFirst({
    where: {
      patientNameNormalized: normalizeName(name),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, patientName: true },
  });
}

// The assignee and facility agent must be active, unless they are the values
// the record already has (so editing an old record never gets blocked).
async function checkRefs(
  data: NewPatientData,
  allowed?: { userId?: string; agentId?: string | null },
): Promise<string | null> {
  if (data.assignedToId !== allowed?.userId) {
    const user = await prisma.user.findFirst({
      where: { id: data.assignedToId, active: true },
      select: { id: true },
    });
    if (!user) return "Assigned user not found or inactive";
  }
  if (data.facilityAgentId && data.facilityAgentId !== allowed?.agentId) {
    const agent = await prisma.facilityAgent.findFirst({
      where: { id: data.facilityAgentId, active: true },
      select: { id: true },
    });
    if (!agent) return "Facility agent not found or inactive";
  }
  return null;
}

function toDb(data: NewPatientData) {
  return {
    patientName: data.patientName,
    patientNameNormalized: normalizeName(data.patientName),
    phone1: data.phone1,
    phone2: data.phone2,
    provider: data.provider,
    appointmentDate: data.appointmentDate,
    assignedToId: data.assignedToId,
    status: data.status,
    source: data.source,
    scheduledReason: data.scheduledReason,
    notes: data.notes,
    receivedDate: data.receivedDate,
    scheduledDate: data.scheduledDate,
    referringFacility: data.referringFacility,
    facilityAgentId: data.facilityAgentId,
  };
}

export async function createPatient(
  data: NewPatientData,
  createdById: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const problem = await checkRefs(data);
  if (problem) return { ok: false, error: problem };

  const created = await prisma.patient.create({
    data: { ...toDb(data), createdById },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updatePatient(
  id: string,
  data: NewPatientData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { assignedToId: true, facilityAgentId: true },
  });
  if (!existing) return { ok: false, error: "Patient not found" };

  const problem = await checkRefs(data, {
    userId: existing.assignedToId,
    agentId: existing.facilityAgentId,
  });
  if (problem) return { ok: false, error: problem };

  try {
    await prisma.patient.update({ where: { id }, data: toDb(data) });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "Patient not found" };
    }
    throw e;
  }
}

export async function deletePatient(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.patient.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "Patient not found" };
    }
    throw e;
  }
}
