// Plain function (no next/* imports). Builds the Excel file in the old sheet's
// column layout, with duplicate patient names removed (newest record wins).
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

export async function buildPatientsWorkbook(): Promise<{
  buffer: ArrayBuffer;
  rowCount: number;
}> {
  const patients = await prisma.patient.findMany({
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
