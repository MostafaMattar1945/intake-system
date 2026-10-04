import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeName } from "@/lib/normalize";
import {
  credentialPasswordSchema,
  createCredentialUser,
} from "@/server/auth/create-credential-user";
import {
  changeUserRole,
  deactivateUser,
  reactivateUser,
} from "@/server/users/admin-actions";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

const EXPECTED_DUPLICATE_EMAIL_ERROR =
  "A user with this email already exists.";
const EXPECTED_USER_NOT_FOUND_ERROR = "User not found";
const EXPECTED_LAST_ACTIVE_ADMIN_ERROR =
  "Cannot deactivate or demote the last active admin";

const ERROR_EMAIL_ALREADY_IN_USE = "Email already in use";
const ERROR_USER_NOT_FOUND = "User not found";
const ERROR_CANNOT_REMOVE_LAST_ACTIVE_ADMIN =
  "Cannot remove the last active admin";
const ERROR_INVALID_INPUT = "Invalid input";

function mapKnownServiceError(err: unknown): string | null {
  if (err instanceof z.ZodError) return ERROR_INVALID_INPUT;

  if (err instanceof Error) {
    if (err.message === EXPECTED_DUPLICATE_EMAIL_ERROR) {
      return ERROR_EMAIL_ALREADY_IN_USE;
    }
    if (err.message === EXPECTED_USER_NOT_FOUND_ERROR) {
      return ERROR_USER_NOT_FOUND;
    }
    if (err.message === EXPECTED_LAST_ACTIVE_ADMIN_ERROR) {
      return ERROR_CANNOT_REMOVE_LAST_ACTIVE_ADMIN;
    }
  }

  return null;
}

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<UserListRow[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  actingAdminId: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  void params.actingAdminId;

  try {
    const user = await createCredentialUser({
      email: params.email,
      name: params.name,
      password: params.password,
      role: params.role,
    });

    return { ok: true, userId: user.id };
  } catch (err) {
    const mapped = mapKnownServiceError(err);
    if (mapped) return { ok: false, error: mapped };
    throw err;
  }
}

export async function deactivateUserService(
  targetId: string,
  actingAdminId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    const user = await deactivateUser(targetId, actingAdminId);
    return { ok: true, userId: user.id };
  } catch (err) {
    const mapped = mapKnownServiceError(err);
    if (mapped) return { ok: false, error: mapped };
    throw err;
  }
}

export async function reactivateUserService(
  targetId: string,
  actingAdminId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    const user = await reactivateUser(targetId, actingAdminId);
    return { ok: true, userId: user.id };
  } catch (err) {
    const mapped = mapKnownServiceError(err);
    if (mapped) return { ok: false, error: mapped };
    throw err;
  }
}

export async function changeUserRoleService(
  targetId: string,
  nextRole: UserRole,
  actingAdminId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    const user = await changeUserRole(targetId, nextRole, actingAdminId);
    return { ok: true, userId: user.id };
  } catch (err) {
    const mapped = mapKnownServiceError(err);
    if (mapped) return { ok: false, error: mapped };
    throw err;
  }
}

export async function resetUserPassword(params: {
  targetId: string;
  newPassword: string;
  actingAdminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void params.actingAdminId;

  const parsedPassword = credentialPasswordSchema.safeParse(params.newPassword);
  if (!parsedPassword.success) {
    return { ok: false, error: "Unable to reset password" };
  }

  // Hash BEFORE the transaction
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(parsedPassword.data);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.account.updateMany({
      where: {
        userId: params.targetId,
        providerId: "credential",
        accountId: params.targetId,
      },
      data: {
        password: passwordHash,
      },
    });

    if (updated.count !== 1) {
      return { ok: false as const, error: "Unable to reset password" };
    }

    await tx.session.deleteMany({
      where: { userId: params.targetId },
    });

    return { ok: true as const };
  });
}

const facilityAgentNameSchema = z
  .string()
  .trim()
  .min(1, "Facility agent name is required")
  .max(100, "Facility agent name is too long");

export type FacilityAgentListRow = {
  id: string;
  name: string;
  nameNormalized: string;
  active: boolean;
};

export async function listFacilityAgents(): Promise<FacilityAgentListRow[]> {
  return prisma.facilityAgent.findMany({
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      active: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function addFacilityAgent(params: {
  name: string;
  actingAdminId: string;
}): Promise<
  | { ok: true; facilityAgentId: string }
  | { ok: false; error: string }
> {
  void params.actingAdminId;

  const parsedName = facilityAgentNameSchema.safeParse(params.name);
  if (!parsedName.success) {
    return {
      ok: false,
      error: parsedName.error.issues[0]?.message ?? "Invalid facility agent name",
    };
  }

  const name = parsedName.data;
  const nameNormalized = normalizeName(name);

  try {
    const created = await prisma.facilityAgent.create({
      data: { name, nameNormalized, active: true },
    });

    return { ok: true, facilityAgentId: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.facilityAgent.findUnique({
        where: { nameNormalized },
      });

      if (!existing) throw err;

      if (existing.active) {
        return { ok: false, error: "already exists" };
      }

      const reactivated = await prisma.facilityAgent.update({
        where: { id: existing.id },
        data: { name, active: true, nameNormalized },
      });

      return { ok: true, facilityAgentId: reactivated.id };
    }

    throw err;
  }
}

export async function renameFacilityAgent(params: {
  facilityAgentId: string;
  name: string;
  actingAdminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void params.actingAdminId;

  const parsedName = facilityAgentNameSchema.safeParse(params.name);
  if (!parsedName.success) {
    return {
      ok: false,
      error: parsedName.error.issues[0]?.message ?? "Invalid facility agent name",
    };
  }

  const name = parsedName.data;
  const nameNormalized = normalizeName(name);

  try {
    await prisma.facilityAgent.update({
      where: { id: params.facilityAgentId },
      data: {
        name,
        nameNormalized,
        // IMPORTANT: do not force active=true on rename.
      },
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Facility agent name already exists" };
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Facility agent not found" };
    }

    throw err;
  }
}

export async function deactivateFacilityAgent(params: {
  facilityAgentId: string;
  actingAdminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void params.actingAdminId;

  try {
    await prisma.facilityAgent.update({
      where: { id: params.facilityAgentId },
      data: { active: false },
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Facility agent not found" };
    }

    throw err;
  }
}

export async function reactivateFacilityAgent(params: {
  facilityAgentId: string;
  actingAdminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void params.actingAdminId;

  try {
    await prisma.facilityAgent.update({
      where: { id: params.facilityAgentId },
      data: { active: true },
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Facility agent not found" };
    }

    throw err;
  }
}
