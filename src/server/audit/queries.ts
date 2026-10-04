import { prisma } from "@/lib/prisma";
import { Prisma, type AuditAction } from "@prisma/client";
import { dayStartUtc, nextDayStartUtc } from "@/lib/time";

const PAGE_SIZE = 50;
export const EXPORT_LIMIT = 50000;

export type AuditRange = { from: Date | null; toExclusive: Date | null; fromText: string; toText: string };

export function parseDateRange(rawFrom: unknown, rawTo: unknown): AuditRange {
  const fromText = typeof rawFrom === "string" ? rawFrom : "";
  const toText = typeof rawTo === "string" ? rawTo : "";

  const from = dayStartUtc(fromText);
  const toExclusive = nextDayStartUtc(toText);

  if (from && toExclusive && from >= toExclusive) {
    return { from: null, toExclusive: null, fromText: "", toText: "" };
  }

  return {
    from: from ?? null,
    toExclusive: toExclusive ?? null,
    fromText: from ? fromText : "",
    toText: toExclusive ? toText : ""
  };
}

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

export async function listAuditLogs(rawPage: unknown, range: AuditRange): Promise<{
  rows: AuditLogListRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const page = clampPage(rawPage);
  const skip = (page - 1) * PAGE_SIZE;

  const where = { createdAt: { gte: range.from ?? undefined, lt: range.toExclusive ?? undefined } };
  const filter = (range.from || range.toExclusive) ? where : {};

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
      where: filter,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: filter }),
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

export async function countAuditLogs(range: AuditRange): Promise<number> {
  const where = { createdAt: { gte: range.from ?? undefined, lt: range.toExclusive ?? undefined } };
  const filter = (range.from || range.toExclusive) ? where : {};
  return prisma.auditLog.count({ where: filter });
}

export async function listAllAuditLogsForExport(range: AuditRange): Promise<AuditLogListRow[]> {
  const where = { createdAt: { gte: range.from ?? undefined, lt: range.toExclusive ?? undefined } };
  const filter = (range.from || range.toExclusive) ? where : {};

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
    where: filter,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_LIMIT,
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
