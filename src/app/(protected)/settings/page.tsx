import { requireAdminOrRedirect } from "@/server/auth/authorization";
import {
  listUsers,
  listFacilityAgents,
} from "@/server/settings/services";
import { AgentsSection, UsersSection } from "./settings-forms";

export default async function SettingsPage() {
  // Real authorization boundary: must stay the first statement, outside any try/catch.
  const { user } = await requireAdminOrRedirect();

  const [users, agents] = await Promise.all([
    listUsers(),
    listFacilityAgents(),
  ]);

  // Only plain, serializable fields cross to the client components.
  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  }));

  const agentRows = agents.map((a) => ({
    id: a.id,
    name: a.name,
    active: a.active,
  }));

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
      <UsersSection users={userRows} currentUserId={user.id} />
      <AgentsSection agents={agentRows} />
    </div>
  );
}
