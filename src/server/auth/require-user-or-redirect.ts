import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/authorization";

// Pages and server actions call this instead of repeating the try/catch.
// UNAUTHORIZED -> /login; anything else is rethrown.
export async function requireUserOrRedirect() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    throw e;
  }
}
