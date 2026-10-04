import { Source, Status } from "@prisma/client";

export const STATUS_LABELS = {
  [Status.SCHEDULED]: "Scheduled",
  [Status.VOICEMAIL]: "Voicemail",
  [Status.SPANISH]: "Spanish",
  [Status.NOT_ELIGIBLE]: "Not Eligible",
} as const satisfies Record<Status, string>;

export const SOURCE_LABELS = {
  [Source.FACILITY_REFERRAL]: "Facility Referral (Queue)",
  [Source.INSURANCE_REFERRAL]: "Insurance Referral",
  [Source.FAX_REFERRAL]: "Fax Referral",
  [Source.ONLINE_REQUESTS]: "Online Requests",
  [Source.PODIUM]: "Podium",
  [Source.GOOGLE]: "Google",
  [Source.ONLINE_SEARCH]: "Online Search",
  [Source.CHATGPT]: "ChatGPT",
  [Source.WORD_OF_MOUTH]: "Word of mouth",
  [Source.RETURNING_PATIENT]: "Returning Patient",
} as const satisfies Record<Source, string>;

export const FACILITY_SOURCES = [
  Source.FACILITY_REFERRAL,
  Source.INSURANCE_REFERRAL,
  Source.FAX_REFERRAL,
] as const satisfies readonly Source[];

export function isFacilitySource(
  source: Source,
): source is (typeof FACILITY_SOURCES)[number] {
  return (FACILITY_SOURCES as readonly Source[]).includes(source);
}
