import { Prisma, type AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditMetadata = Record<string, string | number | boolean | null>;

export async function logAudit(params: {
  action: AuditAction;
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  metadata?: AuditMetadata;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId ?? null,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata,
      },
    });
  } catch (err) {
    // Never log the metadata or the Prisma message (it can echo the values).
    const reason =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? err.code
        : err instanceof Error
          ? err.name
          : "unknown";
    console.error("Audit log write failed:", reason);
  }
}
