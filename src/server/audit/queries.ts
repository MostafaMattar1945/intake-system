import { prisma } from "@/lib/prisma";
import { Prisma, type AuditAction } from "@prisma/client";

const PAGE_SIZE = 50;

function clampPage(raw: unknown): number {
  const p = Number(raw);
  if (Number.isNaN(p) || p < 1) return 1;
  const clamped = Math.floor(p);
  return Math.min(clamped, 100000);
}

export type AuditLogListRow = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export async function listAuditLogs(rawPage: unknown): Promise<{
  rows: AuditLogListRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const page = clampPage(rawPage);
  const skip = (page - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt,
      actorName: r.actor?.name ?? null,
      actorEmail: r.actor?.email ?? null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function listAllAuditLogsForExport(): Promise<AuditLogListRow[]> {
  const rows = await prisma.auditLog.findMany({
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50000,
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
    createdAt: r.createdAt,
    actorName: r.actor?.name ?? null,
    actorEmail: r.actor?.email ?? null,
  }));
}
