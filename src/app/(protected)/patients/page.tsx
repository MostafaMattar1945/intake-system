import { FACILITY_SOURCES, SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { requireUserOrRedirect } from "@/server/auth/require-user-or-redirect";
import {
  listActiveFacilityAgents,
  listAssignableUsers,
  listPatients,
  listProviders,
} from "@/server/patients/services";

import { ImportPanel } from "./import-panel";
import { PatientsWorkspace } from "./patients-workspace";

function toOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { user } = await requireUserOrRedirect();

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  const [patients, assignees, agents, providers] = await Promise.all([
    listPatients(query),
    listAssignableUsers(),
    listActiveFacilityAgents(),
    listProviders(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Patients</h1>
        {/* Plain <a>: a download, not a page navigation. */}
        <a
          href="/patients/export"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Export to Excel
        </a>
      </div>
      <ImportPanel />
      <PatientsWorkspace
        patients={patients}
        assignees={assignees}
        agents={agents}
        providers={providers}
        statusOptions={toOptions(STATUS_LABELS)}
        sourceOptions={toOptions(SOURCE_LABELS)}
        facilitySources={[...FACILITY_SOURCES]}
        isAdmin={user.role === "ADMIN"}
        initialQuery={query}
      />
    </div>
  );
}
