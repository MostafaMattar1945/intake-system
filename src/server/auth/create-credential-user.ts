import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

const userInputSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().trim().min(1, "Name cannot be empty"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export interface CreateUserArgs {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  isBootstrap?: boolean;
}

export async function createCredentialUser(args: CreateUserArgs) {
  // Validate inputs
  const { email, name, password } = userInputSchema.parse({
    email: args.email,
    name: args.name,
    password: args.password,
  });

  // Force ADMIN role inside helper if isBootstrap is true
  const finalRole = args.isBootstrap ? UserRole.ADMIN : args.role;
  if (!finalRole) {
    throw new Error("Role must be explicitly provided outside of bootstrap");
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Take transaction-level advisory lock (blocks concurrent runs)
      // Lock ID is a 64-bit integer. 1000 is used for user bootstrap/creation logic.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1000)`;

      if (args.isBootstrap) {
        // 2. Count users (safe from races because this transaction holds the lock)
        const count = await tx.user.count();
        if (count > 0) {
          throw new Error("Bootstrap failed: Users already exist.");
        }
      }

      // 3. Generate IDs
      const userId = ctx.generateId({ model: "user" });
      const accountId = ctx.generateId({ model: "account" });

      if (!userId || !accountId) {
        throw new Error("ID generation failed (returned false)");
      }

      // 4. Insert User and Account together (mirrors signUpEmail exactly)
      const user = await tx.user.create({
        data: {
          id: userId,
          email: email.toLowerCase(),
          name,
          emailVerified: true, // Internal/Admin created users can log in immediately
          role: finalRole,
          active: true,
          // 5. Insert Account natively nested inside the User insert
          accounts: {
            create: {
              id: accountId,
              providerId: "credential",
              accountId: userId,
              password: hash,
            },
          },
        },
      });

      return user;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("A user with this email already exists.");
    }
    throw error;
  }
}
