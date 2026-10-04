import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/authorization";

export default async function DashboardPage() {
  let user: Awaited<ReturnType<typeof requireUser>>["user"] | null = null;
  try {
    ({ user } = await requireUser());
  } catch (e) {
    if (!(e instanceof Error && e.message === "UNAUTHORIZED")) throw e;
  }
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="text-zinc-700">Welcome, {user.name}.</p>
    </div>
  );
}
