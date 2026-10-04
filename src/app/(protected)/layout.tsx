import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/authorization";
import { signOutAction } from "@/server/auth/actions";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await (async () => {
    try {
      return await requireUser();
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        redirect("/login");
      }
      throw e;
    }
  })();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600">Signed in</div>
            <div className="font-medium text-zinc-900">{user.name}</div>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
