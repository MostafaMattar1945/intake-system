"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";

import {
  deletePatientAction,
  savePatientAction,
  updatePatientAction,
  type PatientActionState,
} from "@/server/patients/actions";

type Option = { value: string; label: string };

export type PatientRowProps = {
  id: string;
  patientName: string;
  phone1: string;
  phone2: string | null;
  provider: string | null;
  appointmentDate: string | null;
  assignedToId: string;
  assignedToName: string;
  status: string;
  source: string;
  scheduledReason: string;
  notes: string | null;
  receivedDate: string | null;
  scheduledDate: string | null;
  referringFacility: string | null;
  facilityAgentId: string | null;
  facilityAgentName: string | null;
};

type SharedProps = {
  assignees: Option[];
  agents: Option[];
  providers: string[];
  statusOptions: Option[];
  sourceOptions: Option[];
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900";
const buttonClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50";
const primaryButtonClass =
  "rounded-lg bg-brand-button px-4 py-2 text-sm font-semibold text-white hover:bg-brand-button-hover disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-700">
      <span>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function PatientForm({
  editing,
  onDone,
  assignees,
  agents,
  providers,
  statusOptions,
  sourceOptions,
}: SharedProps & { editing: PatientRowProps | null; onDone: () => void }) {
  const isEdit = editing !== null;
  const [status, setStatus] = useState(editing?.status ?? "");
  const [source, setSource] = useState(editing?.source ?? "");
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, pending] = useActionState<PatientActionState, FormData>(
    async (prev, formData) => {
      const result = await (isEdit ? updatePatientAction : savePatientAction)(
        prev,
        formData,
      );
      if (result?.ok) {
        if (isEdit) {
          onDone();
        } else {
          setStatus("");
          setSource("");
          setFormKey((k) => k + 1); // clears the form for the next patient
        }
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const duplicate = state && !state.ok ? state.duplicate : undefined;
  const generalError =
    state && !state.ok && !duplicate && !state.fieldErrors ? state.error : undefined;

  // Keep a record editable even if its assignee/agent was deactivated later.
  const assigneeOptions =
    editing && !assignees.some((a) => a.value === editing.assignedToId)
      ? [
          ...assignees,
          { value: editing.assignedToId, label: `${editing.assignedToName} (inactive)` },
        ]
      : assignees;
  const agentOptions =
    editing?.facilityAgentId && !agents.some((a) => a.value === editing.facilityAgentId)
      ? [
          ...agents,
          {
            value: editing.facilityAgentId,
            label: `${editing.facilityAgentName ?? "Agent"} (inactive)`,
          },
        ]
      : agents;

  return (
    <form
      key={formKey}
      action={formAction}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-lg font-semibold text-zinc-900">
        {editing ? `Edit patient: ${editing.patientName}` : "New patient"}
      </h2>
      {editing && <input type="hidden" name="patientId" value={editing.id} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Patient name" required error={errors.patientName}>
          <input
            name="patientName"
            required
            defaultValue={editing?.patientName ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Phone number 1" required error={errors.phone1}>
          <input
            name="phone1"
            type="tel"
            required
            defaultValue={editing?.phone1 ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Phone number 2" error={errors.phone2}>
          <input
            name="phone2"
            type="tel"
            defaultValue={editing?.phone2 ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Provider" required error={errors.provider}>
          <input
            name="provider"
            list="provider-options"
            required
            defaultValue={editing?.provider ?? ""}
            className={inputClass}
          />
          <datalist id="provider-options">
            {providers.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Appointment date" required error={errors.appointmentDate}>
          <input
            name="appointmentDate"
            type="date"
            required
            defaultValue={editing?.appointmentDate ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Assigned to" required error={errors.assignedToId}>
          <select
            name="assignedToId"
            required
            defaultValue={editing?.assignedToId ?? ""}
            className={inputClass}
          >
            <option value="">Select...</option>
            {assigneeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" required error={errors.status}>
          <select
            name="status"
            required
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">Select...</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source" required error={errors.source}>
          <select
            name="source"
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={inputClass}
          >
            <option value="">Select...</option>
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Scheduled / reason if not scheduled"
          required
          error={errors.scheduledReason}
        >
          <input
            name="scheduledReason"
            required
            defaultValue={editing?.scheduledReason ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Received date" required error={errors.receivedDate}>
          <input
            name="receivedDate"
            type="date"
            required
            defaultValue={editing?.receivedDate ?? ""}
            className={inputClass}
          />
        </Field>
        <Field
          label="Scheduled date"
          required={status === "SCHEDULED"}
          error={errors.scheduledDate}
        >
          <input
            name="scheduledDate"
            type="date"
            required={status === "SCHEDULED"}
            defaultValue={editing?.scheduledDate ?? ""}
            className={inputClass}
          />
        </Field>
        <Field
          label="Referring facility"
          error={errors.referringFacility}
        >
          <input
            name="referringFacility"
            defaultValue={editing?.referringFacility ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Facility agent" error={errors.facilityAgentId}>
          <select
            name="facilityAgentId"
            defaultValue={editing?.facilityAgentId ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {agentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" error={errors.notes}>
          <textarea
            name="notes"
            rows={2}
            defaultValue={editing?.notes ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      {duplicate && (
        <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            A patient named &quot;{duplicate.name}&quot; already exists. Update that
            record with what you entered, save this as a separate patient, or change
            the name and save again.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              name="duplicateAction"
              value="update"
              disabled={pending}
              className={buttonClass}
            >
              Update existing record
            </button>
            <button
              type="submit"
              name="duplicateAction"
              value="anyway"
              disabled={pending}
              className={buttonClass}
            >
              Save as new patient
            </button>
          </div>
        </div>
      )}

      {generalError && (
        <p role="alert" className="text-sm text-red-600">
          {generalError}
        </p>
      )}
      {state?.ok && <p className="text-sm text-green-700">{state.message}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Save & add next patient"}
        </button>
        {isEdit && (
          <button type="button" onClick={onDone} className={buttonClass}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function DeletePatientForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<PatientActionState, FormData>(
    deletePatientAction,
    null,
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Delete this patient record? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="patientId" value={id} />
      <button type="submit" disabled={pending} className={buttonClass}>
        Delete
      </button>
      {state && !state.ok && state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function PatientsWorkspace({
  patients,
  isAdmin,
  initialQuery,
  ...shared
}: SharedProps & {
  patients: PatientRowProps[];
  isAdmin: boolean;
  initialQuery: string;
}) {
  const [editing, setEditing] = useState<PatientRowProps | null>(null);

  return (
    <div className="space-y-8">
      <PatientForm
        key={editing?.id ?? "new"}
        editing={editing}
        onDone={() => setEditing(null)}
        {...shared}
      />

      <section className="space-y-3">
        <form action="/patients" method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={initialQuery}
            placeholder="Search name, phone, provider, facility, assigned to"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </form>

        <p className="text-sm text-zinc-600">
          {patients.length} record{patients.length === 1 ? "" : "s"}
          {patients.length === 200 ? " (showing the newest 200; refine your search)" : ""}
        </p>

        {patients.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No patients found. Add one with the form above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-brand-bg-light text-zinc-600">
                <tr>
                  {[
                    "Patient",
                    "Phone 1",
                    "Phone 2",
                    "Provider",
                    "Appointment",
                    "Assigned to",
                    "Status",
                    "Source",
                    "Scheduled / reason",
                    "Received",
                    "Scheduled",
                    "Facility",
                    "Agent",
                    "Notes",
                    "",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-800">
                {patients.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{p.patientName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.phone1}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.phone2 ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.provider ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.appointmentDate ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.assignedToName}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {labelOf(shared.statusOptions, p.status)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {labelOf(shared.sourceOptions, p.source)}
                    </td>
                    <td className="px-3 py-2">{p.scheduledReason}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.receivedDate ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.scheduledDate ?? ""}</td>
                    <td className="px-3 py-2">{p.referringFacility ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">{p.facilityAgentName ?? ""}</td>
                    <td className="px-3 py-2">{p.notes ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={buttonClass}
                        >
                          Edit
                        </button>
                        {isAdmin && <DeletePatientForm id={p.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
