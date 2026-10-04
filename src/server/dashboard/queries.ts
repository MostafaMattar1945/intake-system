import { prisma } from "@/lib/prisma";
import { Status } from "@prisma/client";

export async function getDashboardStats() {
  const [
    totalAdded,
    uniquePatients,
    scheduledCount,
    facilityAgentCount,
    usersWithActivity,
    users,
    agents,
    scheduledByAgent,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.patient.groupBy({ by: ["patientNameNormalized"] }).then((g) => g.length),
    prisma.patient.count({ where: { status: Status.SCHEDULED } }),
    prisma.facilityAgent.count({ where: { active: true } }),
    prisma.auditLog
      .findMany({
        where: { actorUserId: { not: null } },
        select: { actorUserId: true },
        distinct: ["actorUserId"],
      })
      .then((l) => l.length),
    prisma.user.findMany({
      select: {
        name: true,
        role: true,
        active: true,
        _count: { select: { createdPatients: true, auditLogs: true } },
      },
    }),
    prisma.facilityAgent.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        _count: { select: { patients: true } },
      },
    }),
    prisma.patient.groupBy({
      by: ["facilityAgentId"],
      where: { status: Status.SCHEDULED, facilityAgentId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const scheduledMap = new Map(scheduledByAgent.map((g) => [g.facilityAgentId, g._count._all]));

  const perUser = users
    .map((u) => ({
      name: u.name,
      role: u.role,
      active: u.active,
      patientsEntered: u._count.createdPatients,
      totalActions: u._count.auditLogs,
    }))
    .sort((a, b) => b.totalActions - a.totalActions || a.name.localeCompare(b.name));

  const perFacilityAgent = agents
    .map((a) => ({
      name: a.name,
      active: a.active,
      patients: a._count.patients,
      scheduled: scheduledMap.get(a.id) ?? 0,
    }))
    .sort((a, b) => b.patients - a.patients || a.name.localeCompare(b.name));

  return {
    totalAdded,
    uniquePatients,
    scheduledCount,
    facilityAgentCount,
    usersWithActivity,
    perUser,
    perFacilityAgent,
  };
}
