// All user-facing times in this app are California time (Pacific, DST-aware).
// Timestamps (createdAt, audit log) are real instants stored in UTC; we convert
// only for display, export and date-range filtering. Calendar dates (appointment,
// received, scheduled) are plain days with no time zone and are NOT converted.

export const TIME_ZONE = "America/Los_Angeles";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** "2026-10-04 15:42:10 PDT" */
export function formatDateTime(date: Date): string {
  const p = dateTimeFormat.formatToParts(date);
  return (
    `${part(p, "year")}-${part(p, "month")}-${part(p, "day")} ` +
    `${part(p, "hour")}:${part(p, "minute")}:${part(p, "second")} ${part(p, "timeZoneName")}`
  );
}

/** "2026-10-04": the calendar day it currently is in California. */
export function formatDayInZone(date: Date): string {
  return formatDateTime(date).slice(0, 10);
}

// Offset of California from UTC at an instant, in minutes (-480 or -420).
function offsetMinutes(instant: Date): number {
  const p = dateTimeFormat.formatToParts(instant);
  const asUtc = Date.UTC(
    Number(part(p, "year")),
    Number(part(p, "month")) - 1,
    Number(part(p, "day")),
    Number(part(p, "hour")),
    Number(part(p, "minute")),
    Number(part(p, "second")),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

function parseDay(day: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null; // e.g. 2026-02-31
  }
  return { y, m, d };
}

function startOfDay(y: number, m: number, d: number): Date {
  const naive = Date.UTC(y, m - 1, d); // this midnight, read as if it were UTC
  let guess = naive - offsetMinutes(new Date(naive)) * 60000;
  guess = naive - offsetMinutes(new Date(guess)) * 60000; // second pass settles DST days
  return new Date(guess);
}

/** The instant California midnight starts on "YYYY-MM-DD", or null if invalid. */
export function dayStartUtc(day: string): Date | null {
  const parsed = parseDay(day);
  return parsed ? startOfDay(parsed.y, parsed.m, parsed.d) : null;
}

/** The instant California midnight starts on the day AFTER "YYYY-MM-DD". */
export function nextDayStartUtc(day: string): Date | null {
  const parsed = parseDay(day);
  if (!parsed) return null;
  const next = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + 1));
  return startOfDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
