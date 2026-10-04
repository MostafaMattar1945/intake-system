import { Source, Status } from "@prisma/client";
import { z } from "zod";

const REQUIRED_STRING_MESSAGE = "Required";
const INVALID_DATE_MESSAGE = "Enter a valid date";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().optional(),
);

const requiredTrimmedString = (message = REQUIRED_STRING_MESSAGE) =>
  z.string({ error: message }).trim().min(1, message);

const requiredDateString = (message = REQUIRED_STRING_MESSAGE) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .pipe(z.iso.date({ error: INVALID_DATE_MESSAGE }));

const optionalDateString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.iso.date({ error: INVALID_DATE_MESSAGE }).optional(),
);

export const patientConditionalRules = {
  isScheduledDateRequired(status: Status): boolean {
    return status === Status.SCHEDULED;
  },
  isReferringFacilityRequired(source: Source): boolean {
    void source;
    return false;
  },
  isFacilityAgentRequired(source: Source): boolean {
    void source;
    return false;
  },
};

export const newPatientSchema = z
  .object({
    patientName: requiredTrimmedString("Patient name is required"),
    phone1: requiredTrimmedString("Phone 1 is required"),
    phone2: optionalTrimmedString,
    provider: requiredTrimmedString("Provider is required"),
    appointmentDate: requiredDateString("Appointment date is required"),
    assignedToId: requiredTrimmedString("Assigned to is required"),
    status: z.enum(Status, { error: "Status is required" }),
    source: z.enum(Source, { error: "Source is required" }),
    scheduledReason: requiredTrimmedString("Scheduled/reason is required"),
    notes: optionalTrimmedString,
    receivedDate: requiredDateString("Received date is required"),
    scheduledDate: optionalDateString,
    referringFacility: optionalTrimmedString,
    facilityAgentId: optionalTrimmedString,
  })
  .superRefine((patient, context) => {
    if (
      patientConditionalRules.isScheduledDateRequired(patient.status) &&
      !patient.scheduledDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["scheduledDate"],
        message: "Scheduled date is required when status is Scheduled",
      });
    }

    if (
      patientConditionalRules.isFacilityAgentRequired(patient.source) &&
      !patient.facilityAgentId
    ) {
      context.addIssue({
        code: "custom",
        path: ["facilityAgentId"],
        message: "Facility agent is required for this source",
      });
    }
  })
  .transform((patient) => ({
    ...patient,
    phone2: patient.phone2 ?? null,
    notes: patient.notes ?? null,
    appointmentDate: new Date(`${patient.appointmentDate}T00:00:00.000Z`),
    receivedDate: new Date(`${patient.receivedDate}T00:00:00.000Z`),
    scheduledDate: patient.scheduledDate
      ? new Date(`${patient.scheduledDate}T00:00:00.000Z`)
      : null,
    referringFacility: patient.referringFacility ?? null,
    facilityAgentId: patient.facilityAgentId ?? null,
  }));

export type NewPatientInput = z.input<typeof newPatientSchema>;
export type NewPatientData = z.output<typeof newPatientSchema>;
