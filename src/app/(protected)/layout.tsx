import type { ReactNode } from "react";
import Link from "next/link";
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
      <header className="border-t-[3px] border-t-brand-primary border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm text-zinc-600">Signed in</div>
              <div className="font-medium text-zinc-900">{user.name}</div>
            </div>

            <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600">
              <Link href="/patients" className="hover:text-zinc-900">
                Patients
              </Link>
              {user.role === "ADMIN" && (
                <>
                  <Link href="/settings" className="hover:text-zinc-900">
                    Settings
                  </Link>
                  <Link href="/audit" className="hover:text-zinc-900">
                    Audit log
                  </Link>
                </>
              )}
            </nav>
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
