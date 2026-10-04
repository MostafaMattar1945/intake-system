"use client";

import { useActionState, type ReactNode } from "react";
import {
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  changeUserRoleAction,
  resetUserPasswordAction,
  addFacilityAgentAction,
  renameFacilityAgentAction,
  deactivateFacilityAgentAction,
  reactivateFacilityAgentAction,
} from "@/server/settings/actions";

type ActionState = { ok: true } | { ok: false; error: string };
type Action = (prevState: unknown, formData: FormData) => Promise<ActionState>;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  active: boolean;
  createdAt: string; // ISO string
};

export type AgentRow = {
  id: string;
  name: string;
  active: boolean;
};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";
const buttonClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

function ActionForm({
  action,
  submitLabel,
  successText,
  children,
  className,
  primary,
  disabled,
}: {
  action: Action;
  submitLabel: string;
  successText: string;
  children?: ReactNode;
  className?: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    null as ActionState | null,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      <button
        type="submit"
        disabled={pending || disabled}
        className={primary ? primaryButtonClass : buttonClass}
      >
        {pending ? "Saving..." : submitLabel}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="w-full text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="w-full text-sm text-green-700">
          {successText}
        </p>
      ) : null}
    </form>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC" });
}

export function UsersSection({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Users</h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-900">Add a user</h3>
        <ActionForm
          action={createUserAction}
          submitLabel="Create user"
          successText="User created"
          primary
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Full name
            <input name="name" required maxLength={100} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Work email
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              className={inputClass}
            />
            <span className="text-xs text-zinc-500">8 to 128 characters</span>
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Role
            <select name="role" defaultValue="USER" className={inputClass}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </ActionForm>
        <p className="mt-2 text-xs text-zinc-500">
          Type the full name exactly as it appears in the Excel sheet. Import
          matches Assigned To by name.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-zinc-100 align-top">
                  <td className="px-3 py-2 text-zinc-900">
                    {u.name}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-zinc-500">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{u.email}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {u.role === "ADMIN" ? "Admin" : "User"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {u.active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      {u.active ? (
                        <ActionForm
                          action={deactivateUserAction}
                          submitLabel="Deactivate"
                          successText="User deactivated"
                          disabled={isSelf}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="targetId" value={u.id} />
                        </ActionForm>
                      ) : (
                        <ActionForm
                          action={reactivateUserAction}
                          submitLabel="Reactivate"
                          successText="User reactivated"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="targetId" value={u.id} />
                        </ActionForm>
                      )}

                      <ActionForm
                        action={changeUserRoleAction}
                        submitLabel="Change role"
                        successText="Role changed"
                        disabled={isSelf}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="targetId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          disabled={isSelf}
                          className={inputClass}
                        >
                          <option value="USER">User</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </ActionForm>

                      <ActionForm
                        action={resetUserPasswordAction}
                        submitLabel="Reset password"
                        successText="Password reset"
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="targetId" value={u.id} />
                        <input
                          name="newPassword"
                          type="password"
                          required
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                          placeholder="New password"
                          className={inputClass}
                        />
                        <span className="w-full text-xs text-zinc-500">
                          8 to 128 characters. Resetting signs the user out
                          {isSelf ? " (that is you)" : ""}.
                        </span>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AgentsSection({ agents }: { agents: AgentRow[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Facility agents</h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-900">
          Add a facility agent
        </h3>
        <ActionForm
          action={addFacilityAgentAction}
          submitLabel="Add agent"
          successText="Agent added"
          primary
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Agent name
            <input name="name" required maxLength={100} className={inputClass} />
          </label>
        </ActionForm>
        <p className="mt-2 text-xs text-zinc-500">
          Adding a name that was deactivated before brings it back.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-zinc-500">
                  No facility agents yet. Add the first one above.
                </td>
              </tr>
            ) : null}
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 align-top">
                <td className="px-3 py-2 text-zinc-900">{a.name}</td>
                <td className="px-3 py-2 text-zinc-700">
                  {a.active ? "Active" : "Inactive"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    <ActionForm
                      action={renameFacilityAgentAction}
                      submitLabel="Rename"
                      successText="Agent renamed"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="facilityAgentId" value={a.id} />
                      <input
                        name="name"
                        required
                        maxLength={100}
                        defaultValue={a.name}
                        className={inputClass}
                      />
                    </ActionForm>

                    {a.active ? (
                      <ActionForm
                        action={deactivateFacilityAgentAction}
                        submitLabel="Deactivate"
                        successText="Agent deactivated"
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="facilityAgentId"
                          value={a.id}
                        />
                      </ActionForm>
                    ) : (
                      <ActionForm
                        action={reactivateFacilityAgentAction}
                        submitLabel="Reactivate"
                        successText="Agent reactivated"
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="facilityAgentId"
                          value={a.id}
                        />
                      </ActionForm>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
