import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { UserRole } from "@prisma/client";

export async function requireUserFromHeaders(reqHeaders: Headers) {
  const sessionData = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!sessionData?.session || !sessionData?.user) {
    throw new Error("UNAUTHORIZED");
  }

  // Re-read user from live DB to ensure role and active status are fresh
  // (Never trust the session payload for authorization boundaries)
  const liveUser = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
  });

  if (!liveUser) {
    throw new Error("UNAUTHORIZED");
  }

  if (liveUser.active === false) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    session: sessionData.session,
    user: liveUser,
  };
}

export async function requireAdminFromHeaders(reqHeaders: Headers) {
  const result = await requireUserFromHeaders(reqHeaders);

  if (result.user.role !== UserRole.ADMIN) {
    throw new Error("FORBIDDEN");
  }

  return result;
}

export async function requireUser() {
  return requireUserFromHeaders(await headers());
}

export async function requireAdmin() {
  return requireAdminFromHeaders(await headers());
}
