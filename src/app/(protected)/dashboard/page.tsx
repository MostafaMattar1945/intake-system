import { requireUserOrRedirect } from "@/server/auth/require-user-or-redirect";
import { getDashboardStats } from "@/server/dashboard/queries";

export default async function DashboardPage() {
  const { user } = await requireUserOrRedirect();
  const stats = await getDashboardStats();

  const cards = [
    { label: "Total Added", value: stats.totalAdded },
    { label: "Unique Patients", value: stats.uniquePatients },
    { label: "Scheduled", value: stats.scheduledCount },
    { label: "Active Facility Agents", value: stats.facilityAgentCount },
    { label: "Users with Activity", value: stats.usersWithActivity },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="text-zinc-700">Welcome, {user.name}.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-zinc-500">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">User Activity</h2>
          <div className="rounded-md border border-zinc-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Patients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {stats.perUser.map((u, i) => (
                  <tr key={`${u.name}-${i}`} className={!u.active ? "opacity-60" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                      {u.name} {!u.active && "(inactive)"}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{u.role}</td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{u.patientsEntered}</td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{u.totalActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Facility Agents</h2>
          {stats.perFacilityAgent.length === 0 ? (
            <p className="text-sm text-zinc-500">No facility agents yet</p>
          ) : (
            <div className="rounded-md border border-zinc-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Patients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {stats.perFacilityAgent.map((a) => (
                    <tr key={a.name} className={!a.active ? "opacity-60" : ""}>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                        {a.name} {!a.active && "(inactive)"}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700">{a.patients}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700">{a.scheduled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
