# Intake System

Internal patient intake workspace for the Intake Team at Advanced Psychiatry Associates. It replaces a spreadsheet: staff enter new patients one at a time, search and edit records, import and export Excel files, and an Admin manages users and sees an audit trail.

> **Status: working prototype, not production-ready.** See [Not production-ready yet](#not-production-ready-yet) before using it with real patient data.

## Features

- **Login** with work email and password. Public sign-up is disabled; an Admin creates every account.
- **New patient form** with required-field and conditional rules (for example, Scheduled Date is required only when the status is Scheduled) and a **duplicate-name warning** with "Update existing record" or "Save as new patient".
- **Records table** with search, edit, and delete (Admin only).
- **Excel export** in the original sheet's column order (sheet `Raw Data`), duplicate patient names removed (newest wins).
- **Excel / CSV import** that skips duplicate names and reports rejected rows and warnings instead of failing (limits: 10 MB, 5,000 rows).
- **Dashboard**: totals, unique patients, scheduled count, active facility agents, users with activity, per-user and per-facility-agent tables.
- **Settings** (Admin): create, deactivate and reactivate users, change roles, reset passwords, manage facility agents.
- **Audit log** (Admin): logins, patient add/edit/delete, import, export, user and facility-agent changes. Viewable and exportable. It stores ids, counts and field names only, never patient data.

## Roles

| Capability | USER | ADMIN |
|---|---|---|
| Sign in, dashboard | yes | yes |
| Add / edit patients, search | yes | yes |
| Import / export patients | yes | yes |
| Delete patients | no | yes |
| Settings (users, facility agents) | no | yes |
| Audit log (view and export) | no | yes |

Authorization is enforced on the server (pages, server actions and route handlers re-read the user's role and active flag from the database on every request). Hiding a link in the UI is only a convenience.

## Tech stack

Next.js 16 (App Router, TypeScript), PostgreSQL 16, Prisma 6, Better Auth, Tailwind CSS, Zod 4, ExcelJS.

## Getting started

Requirements: Node.js 20.9 or newer, PostgreSQL 16.

```bash
git clone <repo-url> intake-system
cd intake-system
npm ci
```

1. Create a database and a role (example):

   ```sql
   CREATE ROLE intake WITH LOGIN PASSWORD 'choose-a-password';
   CREATE DATABASE intake_dev OWNER intake;
   ```

   For local development only, `ALTER ROLE intake CREATEDB;` is needed because Prisma uses a shadow database for `migrate dev`.

2. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable | Meaning |
   |---|---|
   | `DATABASE_URL` | PostgreSQL connection string |
   | `BETTER_AUTH_SECRET` | Long random secret (`openssl rand -base64 32`) |
   | `BETTER_AUTH_URL` | Exact public URL of the app, for example `http://localhost:3000` |

   Never commit `.env`.

3. Apply the database migrations:

   ```bash
   npx prisma migrate deploy
   ```

4. Create the first Admin (works only while the database has no users; the password is typed hidden and asked twice):

   ```bash
   npm run create-admin
   ```

5. Run the app:

   ```bash
   npm run dev                    # development
   npm run build && npm start     # production build
   ```

   Open the URL you set in `BETTER_AUTH_URL`. Use `localhost` consistently (not `127.0.0.1`): sign-in checks the request origin.

Scripts: `dev`, `build`, `start`, `lint`, `create-admin`.

## Importing and exporting

- The export and the import use the same columns: PatientName, PhoneNumber1, PhoneNumber2, Provider, AppointmentDate, AssignedTo, Status, Source, Scheduled/ReasonIfNotScheduled, Notes, ReceivedDate, ScheduledDate, ReferringFacility, AgentresponsibleforFacility.
- `AssignedTo` is matched to a user's **name** (case and spaces ignored). Create users in Settings with the same names used in the sheet. Unmatched or inactive users cause the row to be rejected in the report.
- Known spelling variants are accepted (for example `VM`, `Not eligable`, `Fax`). Invalid dates become empty with a warning. `na` in Phone 2 becomes empty.
- Patients whose name already exists, or repeats inside the file, are skipped.
- Facility agent names are matched ignoring case; unknown names are created.

## Time and dates

All timestamps (audit log, Settings) are shown in California time (America/Los_Angeles, daylight-saving aware). They are stored in UTC and converted when displayed. Patient dates (appointment, received, scheduled) are calendar days and are not converted.

## Security design

- Sign-up is disabled; the first Admin is created by a one-time script that refuses to run if any user exists.
- Passwords are hashed by Better Auth. Sessions are server-side.
- Deactivated users cannot sign in, and their existing sessions are deleted.
- An admin cannot deactivate or demote themselves, and the last active admin is protected by a database lock.
- Sign-in errors are generic ("Invalid email or password").
- The audit log never contains patient names, phone numbers, notes, emails or passwords.

## Not production-ready yet

Do not use this with real patient data until these are addressed:

- HIPAA compliance review and a signed BAA with the hosting provider.
- Encryption in transit (HTTPS) and at rest, and managed secrets.
- Automated backups with a tested restore, and an audit-log retention policy.
- Access reviews, and a decision on who may export all patients (today any signed-in user can).
- Session hardening and rate limiting on sign-in.
- No password-reset email: an Admin resets passwords in Settings (this signs that user out).
- Failed logins and sign-outs are not audited.
- Known `npm audit` findings in production dependencies (5): the Prisma CLI chain (`deepmerge-ts`) and `uuid` via `exceljs`. Do not run `npm audit fix --force` (it downgrades Prisma and ExcelJS). Re-check before go-live.
- The database role used in development has `CREATEDB`; production uses `prisma migrate deploy` with a normal role.
- Create a new strong production Admin password and rotate every secret before go-live.
- Referring Facility and Facility Agent are optional for all sources.

## Project layout

```
prisma/                     schema and migrations
scripts/create-admin.ts     one-time first-admin script
src/lib/                    auth config, prisma client, validation, constants, time helper
src/server/auth/            authorization helpers, credential-user helper
src/server/users/           admin user actions (last-admin guard)
src/server/settings/        settings services and server actions
src/server/patients/        patient services, import, export
src/server/audit/           audit logging and queries
src/server/dashboard/       dashboard queries
src/app/                    pages, route handlers (login, dashboard, patients, settings, audit)
```

## Roadmap

Seed data for demos, automated tests, per-field audit diffs, password-reset by email, pagination for the records table, role-based export limits.
