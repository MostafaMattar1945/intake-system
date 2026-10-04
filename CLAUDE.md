# Intake System — Advanced Psychiatry Associates (Intake Dept)

Internal patient intake workspace. Replaces an old claude.ai-artifact prototype and an Excel sheet.

## HARD RULES
- NEVER read, open, or reference any real patient spreadsheet or real PHI. Use only fake generated data (seed script with @faker-js/faker) for all development and testing.
- Never commit secrets. `.env` stays in `.gitignore`. Provide `.env.example` only.
- Work in small steps. Commit after each working step with a clear message.
- Before writing code for a new feature, show a short plan and wait for approval.
- Do not add features beyond this file without asking.

## Stack
Next.js (TypeScript, App Router) + PostgreSQL + Prisma 6 + Better Auth (password hashing, server-side sessions) + Tailwind + shadcn/ui + TanStack Table + Zod + ExcelJS.

## Roles
- ADMIN: created once via `npm run create-admin` (scripts/create-admin.ts), never via public sign-up. Admin creates other users and manages the Facility Agent list in Settings, can delete records, sees Audit Log and Settings.
- USER: can add/edit patients, import/export, see dashboard.
- Public sign-up is permanently disabled (emailAndPassword.disableSignUp: true). All users are created by an ADMIN in Settings via src/server/auth/create-credential-user.ts.
- Do NOT use Better Auth's admin plugin; use custom Settings actions.
- Enforce roles on the SERVER (server actions / route handlers), never only in the UI. No dev-only auth bypass.

## Enums (final — do not invent others)
Status (stored as enum, shown with label):
- SCHEDULED = "Scheduled"
- VOICEMAIL = "Voicemail"   (old sheet wrote "VM")
- SPANISH = "Spanish"
- NOT_ELIGIBLE = "Not Eligible"   (old sheet had typos "Not eligible"/"Not eligable")

Source (stored as enum, shown with label):
- FACILITY_REFERRAL = "Facility Referral (Queue)"
- INSURANCE_REFERRAL = "Insurance Referral"
- FAX_REFERRAL = "Fax Referral"
- ONLINE_REQUESTS = "Online Requests"
- PODIUM = "Podium"
- GOOGLE = "Google"
- ONLINE_SEARCH = "Online Search"
- CHATGPT = "ChatGPT"
- WORD_OF_MOUTH = "Word of mouth"
- RETURNING_PATIENT = "Returning Patient"

## Patient fields
Patient Name, Phone Number 1, Phone Number 2 (optional), Provider (free text with autocomplete from existing values), Appointment Date, Assigned To (relation to User), Status, Source, Scheduled / Reason if Not Scheduled (free text; "Scheduled" when status is Scheduled), Notes (optional), Received Date, Scheduled Date, Referring Facility (optional), Facility Agent (relation to FacilityAgent, optional), createdBy, timestamps.

Required (red star): everything except Phone 2 and Notes.
Referring Facility and Facility Agent are optional for all sources.

"Save & add next patient" clears the form. Warn on duplicate patient name (trim, collapse spaces, case-insensitive) and offer to update the existing record.

## FacilityAgent
NOT a login and NOT linked to User. Simple Admin-managed list: id, name, active. Used for the Facility Agent dropdown.

## Import rules (old data is messy — be tolerant)
- Match columns by header name, case/space-insensitive. Skip blank rows. The old sheet has ~10,000 formatted rows but only ~138 real ones.
- Normalize Status: "VM" -> VOICEMAIL; "Not eligible"/"Not eligable" -> NOT_ELIGIBLE.
- Normalize Source: "Fax" -> FAX_REFERRAL; case-insensitive match on labels.
- Dates can be invalid text (e.g. "01-cot"). Do not crash: import the row with that date empty and report it in an import summary (row number + reason). Appointment Date must therefore be nullable in the DB, required in the form.
- Phone 2 values like "na" -> empty.
- Facility Agent names differ only by case (e.g. "mason" vs "Mason"): match case-insensitively, create if missing.
- Skip duplicate patient names and report how many were skipped.
- Analytics columns in the old sheet (AnalyticsStatus, AnalyticsSource, DateQuality, ScheduleLagDays, AppointmentLeadDays, etc.) are derived: do NOT store them, compute them in the dashboard if needed.

## Excel export
Columns in this order: PatientName, PhoneNumber1, PhoneNumber2, Provider, AppointmentDate, AssignedTo, Status, Source, Scheduled/ReasonIfNotScheduled, Notes, ReceivedDate, ScheduledDate, ReferringFacility, AgentresponsibleforFacility. Duplicate patient names removed. Status exported with the display label.

## Dashboard
Unique patients, total added, users with activity, facility agent count, scheduled count, per-user table (patients entered + total actions), per-facility-agent table.

## Audit Log
Every login, add, edit, delete, import, export, user change. Admin-only. Export/import as Excel.

## Plan (3 days)
Day 1: scaffold, Prisma schema (with the enums above), Better Auth, roles, Settings (users + facility agents).
Day 2: patient form, records table, search, duplicate warning.
Day 3: Excel import/export, dashboard, audit log, fake seed data, README.

## README must include a "Not production-ready yet" section
HIPAA compliance, BAA with hosting provider, encryption at rest and in transit, backups, access reviews, session hardening, rate limiting.