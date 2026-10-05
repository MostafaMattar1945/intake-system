// Plain function (no next/* imports). Builds the Excel file in the old sheet's
// column layout, with duplicate patient names removed (newest record wins).
// Optionally filtered by Received Date (a calendar day, stored as DATE at UTC
// midnight, so the range is compared as plain days, never converted to a time zone).
import ExcelJS from "exceljs";

import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const COLUMNS = [
  { header: "PatientName", key: "patientName", width: 28 },
  { header: "PhoneNumber1", key: "phone1", width: 16 },
  { header: "PhoneNumber2", key: "phone2", width: 16 },
  { header: "Provider", key: "provider", width: 22 },
  { header: "AppointmentDate", key: "appointmentDate", width: 16 },
  { header: "AssignedTo", key: "assignedTo", width: 20 },
  { header: "Status", key: "status", width: 14 },
  { header: "Source", key: "source", width: 24 },
  { header: "Scheduled/ReasonIfNotScheduled", key: "scheduledReason", width: 32 },
  { header: "Notes", key: "notes", width: 36 },
  { header: "ReceivedDate", key: "receivedDate", width: 14 },
  { header: "ScheduledDate", key: "scheduledDate", width: 14 },
  { header: "ReferringFacility", key: "referringFacility", width: 26 },
  { header: "AgentresponsibleforFacility", key: "agent", width: 26 },
] as const;

const DATE_KEYS = ["appointmentDate", "receivedDate", "scheduledDate"] as const;

export type ExportRange = { from: Date | null; to: Date | null };

// Strict YYYY-MM-DD that is a real calendar day. Returns the day at UTC midnight,
// or null for anything else (empty, text, 2026-02-31, ...).
export function parseCalendarDay(text: string | null | undefined): Date | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === text ? date : null;
}

export async function buildPatientsWorkbook(
  range: ExportRange = { from: null, to: null },
): Promise<{
  buffer: ArrayBuffer;
  rowCount: number;
}> {
  // Patients without a Received Date are excluded automatically once a bound is set.
  const where =
    range.from || range.to
      ? {
          receivedDate: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {};

  const patients = await prisma.patient.findMany({
    where,
    include: {
      assignedTo: { select: { name: true } },
      facilityAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Newest first, so the first record seen for a name is the one we keep.
  const seen = new Set<string>();
  const unique = patients.filter((p) => {
    if (seen.has(p.patientNameNormalized)) return false;
    seen.add(p.patientNameNormalized);
    return true;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Raw Data");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const p of unique) {
    sheet.addRow({
      patientName: p.patientName,
      phone1: p.phone1,
      phone2: p.phone2 ?? "",
      provider: p.provider ?? "",
      appointmentDate: p.appointmentDate,
      assignedTo: p.assignedTo.name,
      status: STATUS_LABELS[p.status],
      source: SOURCE_LABELS[p.source],
      scheduledReason: p.scheduledReason,
      notes: p.notes ?? "",
      receivedDate: p.receivedDate,
      scheduledDate: p.scheduledDate,
      referringFacility: p.referringFacility ?? "",
      agent: p.facilityAgent?.name ?? "",
    });
  }

  for (const key of DATE_KEYS) {
    sheet.getColumn(key).numFmt = "yyyy-mm-dd";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, rowCount: unique.length };
}
