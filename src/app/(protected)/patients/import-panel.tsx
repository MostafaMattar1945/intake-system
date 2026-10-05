"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

type Report = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  agentsCreated: number;
  rejectedTotal: number;
  rejected: { row: number; reason: string }[];
  warningTotal: number;
  warnings: { row: number; message: string }[];
};

export function ImportPanel() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setPending(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/patients/import", { method: "POST", body });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json && typeof json.error === "string"
            ? json.error
            : "Import failed.";
        setError(message);
        return;
      }
      setReport(json as Report);
      form.reset();
      router.refresh();
    } catch {
      setError("Import failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Import from Excel or CSV</h2>
      <p className="text-sm text-zinc-600">
        Use the same columns as the export. Patients whose name already exists are skipped.
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          name="file"
          type="file"
          accept=".xlsx,.csv"
          required
          className="text-sm text-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-button px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-button-hover disabled:opacity-50"
        >
          {pending ? "Importing..." : "Import"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {report && (
        <div className="space-y-2 text-sm text-zinc-800">
          <p className="font-medium text-green-700">
            Imported {report.imported} of {report.totalRows} rows.
          </p>
          <p>
            Skipped as duplicates: {report.skippedDuplicates}. Rejected: {report.rejectedTotal}.
            Warnings: {report.warningTotal}. Facility agents created: {report.agentsCreated}.
          </p>
          {report.rejected.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium">Rejected rows</summary>
              <ul className="mt-1 list-disc pl-5">
                {report.rejected.map((r, i) => (
                  <li key={`${r.row}-${i}`}>
                    Row {r.row}: {r.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {report.warnings.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium">Warnings</summary>
              <ul className="mt-1 list-disc pl-5">
                {report.warnings.map((w, i) => (
                  <li key={`${w.row}-${i}`}>
                    Row {w.row}: {w.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
