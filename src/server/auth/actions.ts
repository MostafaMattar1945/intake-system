"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { APIError } from "better-auth/api";

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("Invalid email address")),
  password: z.string().min(1, "Password is required"),
});

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState | undefined> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    return { error: "Invalid email or password" };
  }

  const { email, password } = parsed.data;

  try {
    const reqHeaders = await headers();
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: reqHeaders,
    });
  } catch (err) {
    if (err instanceof APIError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        return { error: "Invalid email or password" };
      }
      return { error: "Something went wrong, try again" };
    }

    return { error: "Something went wrong, try again" };
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  try {
    const reqHeaders = await headers();
    await auth.api.signOut({
      headers: reqHeaders,
    });
  } catch (err) {
    if (err instanceof APIError) {
      // Still redirect to login even if Better Auth rejects sign-out.
    } else {
      throw err;
    }
  }

  redirect("/login");
}
