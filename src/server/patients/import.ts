// Plain function (no next/* imports). Reads an .xlsx or .csv file in the old
// sheet's layout and imports it tolerantly: bad rows are reported, never fatal.
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { Prisma, Source, Status } from "@prisma/client";

import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { normalizeName } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

export class ImportError extends Error {}

const MAX_ROWS = 5000;
const REPORT_LIMIT = 200;

export type ImportReport = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  agentsCreated: number;
  rejectedTotal: number;
  rejected: { row: number; reason: string }[];
  warningTotal: number;
  warnings: { row: number; message: string }[];
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADERS = {
  patientname: "patientName",
  phonenumber1: "phone1",
  phonenumber2: "phone2",
  provider: "provider",
  appointmentdate: "appointmentDate",
  assignedto: "assignedTo",
  status: "status",
  source: "source",
  scheduledreasonifnotscheduled: "scheduledReason",
  notes: "notes",
  receiveddate: "receivedDate",
  scheduleddate: "scheduledDate",
  referringfacility: "referringFacility",
  agentresponsibleforfacility: "agent",
} as const;

type FieldKey = (typeof HEADERS)[keyof typeof HEADERS];
type Values = Partial<Record<FieldKey, ExcelJS.CellValue>>;

function lookup<T extends string>(
  labels: Record<T, string>,
  extra: Record<string, T>,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const key of Object.keys(labels) as T[]) map.set(squash(labels[key]), key);
  for (const [alias, key] of Object.entries(extra)) map.set(alias, key);
  return map;
}

const STATUS_LOOKUP = lookup<Status>(STATUS_LABELS, {
  vm: Status.VOICEMAIL,
  noteligible: Status.NOT_ELIGIBLE,
  noteligable: Status.NOT_ELIGIBLE,
});

const SOURCE_LOOKUP = lookup<Source>(SOURCE_LABELS, {
  fax: Source.FAX_REFERRAL,
  facilityreferral: Source.FACILITY_REFERRAL,
  insurance: Source.INSURANCE_REFERRAL,
  onlinerequest: Source.ONLINE_REQUESTS,
  returning: Source.RETURNING_PATIENT,
});

function unwrap(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value !== null && typeof value === "object" && !(value instanceof Date) && "result" in value) {
    return (value.result ?? null) as ExcelJS.CellValue;
  }
  return value;
}

function cellText(raw: ExcelJS.CellValue | undefined): string {
  const value = unwrap(raw ?? null);
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    return "";
  }
  return String(value).trim();
}

type ParsedDate = { date: string | null; invalid: boolean; text: string };

function parseDate(raw: ExcelJS.CellValue | undefined): ParsedDate {
  const value = unwrap(raw ?? null);
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { date: null, invalid: true, text: "" }
      : { date: value.toISOString().slice(0, 10), invalid: false, text: "" };
  }
  const text = cellText(value);
  if (!text) return { date: null, invalid: false, text };

  const bad: ParsedDate = { date: null, invalid: true, text };
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(text);
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (us) {
    m = Number(us[1]);
    d = Number(us[2]);
    y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  } else {
    return bad;
  }

  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 1900 ||
    y > 2100 ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return bad;
  }
  return { date: check.toISOString().slice(0, 10), invalid: false, text };
}

const toUtcDate = (day: string | null) => (day ? new Date(`${day}T00:00:00.000Z`) : null);
const short = (s: string) => (s.length > 30 ? `${s.slice(0, 30)}...` : s);

export async function importPatients(
  file: { name: string; data: Buffer },
  createdById: string,
): Promise<ImportReport> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      await workbook.csv.read(Readable.from(file.data));
    } else {
      await workbook.xlsx.load(file.data as unknown as ExcelJS.Buffer);
    }
  } catch {
    throw new ImportError("Could not read the file. Use an .xlsx or .csv file.");
  }

  const sheet = workbook.getWorksheet("Raw Data") ?? workbook.worksheets[0];
  if (!sheet) throw new ImportError("The file has no sheets.");

  const columns = new Map<number, FieldKey>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = (HEADERS as Record<string, FieldKey>)[squash(cellText(cell.value))];
    if (key) columns.set(col, key);
  });
  if (![...columns.values()].includes("patientName")) {
    throw new ImportError("Header row must include a PatientName column.");
  }

  const rows: { number: number; values: Values }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Values = {};
    for (const [col, key] of columns) values[key] = row.getCell(col).value;
    if (cellText(values.patientName)) rows.push({ number: rowNumber, values });
  });
  if (rows.length > MAX_ROWS) {
    throw new ImportError(`Too many rows (max ${MAX_ROWS}). Split the file.`);
  }

  const [users, agents, existing] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, active: true } }),
    prisma.facilityAgent.findMany({ select: { id: true, nameNormalized: true } }),
    prisma.patient.findMany({ select: { patientNameNormalized: true } }),
  ]);
  const usersByName = new Map<string, { id: string; active: boolean }>();
  for (const u of users) {
    const key = squash(u.name);
    const current = usersByName.get(key);
    if (!current || (!current.active && u.active)) usersByName.set(key, { id: u.id, active: u.active });
  }
  const agentIds = new Map(agents.map((a) => [a.nameNormalized, a.id]));
  const seenNames = new Set(existing.map((p) => p.patientNameNormalized));

  const rejected: { row: number; reason: string }[] = [];
  const warnings: { row: number; message: string }[] = [];
  const toCreate: Prisma.PatientCreateManyInput[] = [];
  let skippedDuplicates = 0;
  let agentsCreated = 0;

  for (const { number, values } of rows) {
    const reject = (reason: string) => rejected.push({ row: number, reason });

    const patientName = cellText(values.patientName);
    const normalized = normalizeName(patientName);
    if (seenNames.has(normalized)) {
      skippedDuplicates += 1;
      continue;
    }

    const phone1 = cellText(values.phone1);
    if (!phone1) {
      reject("Phone number 1 is missing");
      continue;
    }

    const status = STATUS_LOOKUP.get(squash(cellText(values.status)));
    if (!status) {
      reject(`Unknown status "${short(cellText(values.status))}"`);
      continue;
    }

    const source = SOURCE_LOOKUP.get(squash(cellText(values.source)));
    if (!source) {
      reject(`Unknown source "${short(cellText(values.source))}"`);
      continue;
    }

    const assigneeName = cellText(values.assignedTo);
    const assignee = usersByName.get(squash(assigneeName));
    if (!assignee) {
      reject(`Assigned to "${short(assigneeName)}" is not a user. Create the user in Settings and re-import.`);
      continue;
    }
    if (!assignee.active) {
      reject(`Assigned to "${short(assigneeName)}" is an inactive user`);
      continue;
    }

    const dates = {
      appointmentDate: parseDate(values.appointmentDate),
      receivedDate: parseDate(values.receivedDate),
      scheduledDate: parseDate(values.scheduledDate),
    };
    for (const [field, parsed] of Object.entries(dates)) {
      if (parsed.invalid) {
        warnings.push({ row: number, message: `${field} "${short(parsed.text)}" is not a valid date; left empty` });
      }
    }

    let facilityAgentId: string | null = null;
    const agentName = cellText(values.agent);
    if (agentName) {
      const key = normalizeName(agentName);
      facilityAgentId = agentIds.get(key) ?? null;
      if (!facilityAgentId) {
        const created = await prisma.facilityAgent.upsert({
          where: { nameNormalized: key },
          update: {},
          create: { name: agentName, nameNormalized: key, active: true },
        });
        agentIds.set(key, created.id);
        facilityAgentId = created.id;
        agentsCreated += 1;
      }
    }

    const phone2Raw = cellText(values.phone2);
    seenNames.add(normalized); // also skips repeated names inside the same file
    toCreate.push({
      patientName,
      patientNameNormalized: normalized,
      phone1,
      phone2: /^(na|n\/a|none|-+)$/i.test(phone2Raw) ? null : phone2Raw || null,
      provider: cellText(values.provider) || null,
      appointmentDate: toUtcDate(dates.appointmentDate.date),
      assignedToId: assignee.id,
      status,
      source,
      scheduledReason: cellText(values.scheduledReason) || (status === Status.SCHEDULED ? "Scheduled" : ""),
      notes: cellText(values.notes) || null,
      receivedDate: toUtcDate(dates.receivedDate.date),
      scheduledDate: toUtcDate(dates.scheduledDate.date),
      referringFacility: cellText(values.referringFacility) || null,
      facilityAgentId,
      createdById,
    });
  }

  const chunks: Prisma.PatientCreateManyInput[][] = [];
  for (let i = 0; i < toCreate.length; i += 500) chunks.push(toCreate.slice(i, i + 500));
  if (chunks.length > 0) {
    await prisma.$transaction(chunks.map((data) => prisma.patient.createMany({ data })));
  }

  return {
    totalRows: rows.length,
    imported: toCreate.length,
    skippedDuplicates,
    agentsCreated,
    rejectedTotal: rejected.length,
    rejected: rejected.slice(0, REPORT_LIMIT),
    warningTotal: warnings.length,
    warnings: warnings.slice(0, REPORT_LIMIT),
  };
}
