import { prisma } from "@/lib/prisma";
import { Prisma, UserRole } from "@prisma/client";
import { USER_ADMIN_LOCK_ID } from "@/server/auth/locks";

async function enforceLastAdminGuard(
  tx: Prisma.TransactionClient,
  targetId: string,
  targetCurrentRole: UserRole,
  targetCurrentActive: boolean,
  isRemovingAdminStatus: boolean
) {
  if (
    targetCurrentRole === UserRole.ADMIN &&
    targetCurrentActive &&
    isRemovingAdminStatus
  ) {
    const remainingAdmins = await tx.user.count({
      where: {
        role: UserRole.ADMIN,
        active: true,
        id: { not: targetId },
      },
    });

    if (remainingAdmins === 0) {
      throw new Error("Cannot deactivate or demote the last active admin");
    }
  }
}

export async function deactivateUser(targetId: string, actingAdminId: string) {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_ADMIN_LOCK_ID})`;

    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new Error("User not found");
    }

    // Making the user inactive acts as a removal of their active administrative power
    await enforceLastAdminGuard(tx, targetId, target.role, target.active, true);

    const updatedUser = await tx.user.update({
      where: { id: targetId },
      data: { active: false },
    });

    await tx.session.deleteMany({
      where: { userId: targetId },
    });

    return updatedUser;
  });
}

export async function reactivateUser(targetId: string, actingAdminId: string) {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_ADMIN_LOCK_ID})`;

    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new Error("User not found");
    }

    // Reactivation never removes admin status
    await enforceLastAdminGuard(tx, targetId, target.role, target.active, false);

    return await tx.user.update({
      where: { id: targetId },
      data: { active: true },
    });
  });
}

export async function changeUserRole(
  targetId: string,
  targetRole: UserRole,
  actingAdminId: string
) {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_ADMIN_LOCK_ID})`;

    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new Error("User not found");
    }

    const isDemoting = targetRole === UserRole.USER;
    await enforceLastAdminGuard(tx, targetId, target.role, target.active, isDemoting);

    return await tx.user.update({
      where: { id: targetId },
      data: { role: targetRole },
    });
  });
}
