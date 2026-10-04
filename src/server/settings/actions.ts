"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole } from "@prisma/client";

import { requireAdminOrRedirect } from "@/server/auth/authorization";
import { credentialPasswordSchema } from "@/server/auth/create-credential-user";

import {
  addFacilityAgent,
  changeUserRoleService,
  createUser,
  deactivateFacilityAgent,
  deactivateUserService,
  reactivateFacilityAgent,
  reactivateUserService,
  renameFacilityAgent,
  resetUserPassword,
} from "@/server/settings/services";

type ActionState = { ok: true } | { ok: false; error: string };

const idSchema = z.string().trim().min(1);

const roleSchema = z.enum([UserRole.ADMIN, UserRole.USER] as const);

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email("Invalid email address"))
  .transform((v) => v.toLowerCase());

const nameSchema = z.string().trim().min(1, "Name cannot be empty");

const facilityAgentNameSchema = z
  .string()
  .trim()
  .min(1, "Facility agent name is required")
  .max(100, "Facility agent name is too long");

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function createUserAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      name: nameSchema,
      email: emailSchema,
      password: credentialPasswordSchema,
      role: roleSchema,
    })
    .safeParse({
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      password: formString(formData, "password"),
      role: formString(formData, "role"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    role: parsed.data.role,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function deactivateUserAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      targetId: idSchema,
    })
    .safeParse({
      targetId: formString(formData, "targetId"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  if (parsed.data.targetId === user.id) {
    return { ok: false, error: "You cannot change your own account" };
  }

  const result = await deactivateUserService(parsed.data.targetId, user.id);

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function reactivateUserAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      targetId: idSchema,
    })
    .safeParse({
      targetId: formString(formData, "targetId"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await reactivateUserService(parsed.data.targetId, user.id);

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function changeUserRoleAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      targetId: idSchema,
      role: roleSchema,
    })
    .safeParse({
      targetId: formString(formData, "targetId"),
      role: formString(formData, "role"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  if (parsed.data.targetId === user.id) {
    return { ok: false, error: "You cannot change your own account" };
  }

  const result = await changeUserRoleService(
    parsed.data.targetId,
    parsed.data.role,
    user.id,
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function resetUserPasswordAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      targetId: idSchema,
      newPassword: credentialPasswordSchema,
    })
    .safeParse({
      targetId: formString(formData, "targetId"),
      newPassword: formString(formData, "newPassword"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await resetUserPassword({
    targetId: parsed.data.targetId,
    newPassword: parsed.data.newPassword,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function addFacilityAgentAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      name: facilityAgentNameSchema,
    })
    .safeParse({
      name: formString(formData, "name"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await addFacilityAgent({
    name: parsed.data.name,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function renameFacilityAgentAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      facilityAgentId: idSchema,
      name: facilityAgentNameSchema,
    })
    .safeParse({
      facilityAgentId: formString(formData, "facilityAgentId"),
      name: formString(formData, "name"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await renameFacilityAgent({
    facilityAgentId: parsed.data.facilityAgentId,
    name: parsed.data.name,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function deactivateFacilityAgentAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      facilityAgentId: idSchema,
    })
    .safeParse({
      facilityAgentId: formString(formData, "facilityAgentId"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await deactivateFacilityAgent({
    facilityAgentId: parsed.data.facilityAgentId,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}

export async function reactivateFacilityAgentAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAdminOrRedirect();

  const parsed = z
    .object({
      facilityAgentId: idSchema,
    })
    .safeParse({
      facilityAgentId: formString(formData, "facilityAgentId"),
    });

  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const result = await reactivateFacilityAgent({
    facilityAgentId: parsed.data.facilityAgentId,
    actingAdminId: user.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true };
}
