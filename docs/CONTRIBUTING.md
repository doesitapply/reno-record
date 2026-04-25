# The Reno Record — Contributing Guide

**Version:** 1.0 (platform release v3.5)

This document describes the development workflow, code conventions, schema migration process, test requirements, and pull request standards for contributors to The Reno Record.

---

## 1. Stack overview

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS 4 | React 19, Vite 7 |
| UI components | shadcn/ui + Radix UI | — |
| API layer | tRPC 11 | — |
| Backend | Express 4 + tsx | — |
| Database ORM | Drizzle ORM | 0.44 |
| Database | MySQL / TiDB | — |
| File storage | S3 (Manus-managed) | — |
| Auth | Manus OAuth | — |
| AI | Manus built-in LLM (invokeLLM) | — |
| Email | Nodemailer | 6.x |
| Testing | Vitest | 2.x |
| Language | TypeScript 5.9 | strict mode |

---

## 2. Development setup

```bash
# Clone the repository
git clone <repo-url>
cd reno-record

# Install dependencies
pnpm install

# Start the development server (requires DATABASE_URL in environment)
pnpm dev
```

The development server runs on `http://localhost:3000`. Vite serves the frontend with HMR; the Express backend restarts automatically on server file changes via `tsx watch`.

---

## 3. The four-touch-point build loop

Every feature follows this exact sequence. Do not skip steps.

**Step 1: Schema.** Add or modify tables in `drizzle/schema.ts`. Run `pnpm drizzle-kit generate` to produce migration SQL. Review the generated `.sql` file, then apply it via the numbered migration runner script in `scripts/`. Keep the TypeScript schema and the actual database in sync at all times.

**Step 2: Database helpers.** Add query functions to `server/db.ts`. Return raw Drizzle rows. Do not put business logic here — only data access. Keep functions small and composable.

**Step 3: Procedures.** Add or extend tRPC procedures in `server/routers.ts` (or split into `server/routers/<feature>.ts` when the file exceeds 150 lines). Choose `publicProcedure`, `protectedProcedure`, or `adminProcedure` based on the access tier required. Wire audit logging for any security-relevant action.

**Step 4: Frontend.** Build the UI in `client/src/pages/` using shadcn/ui components and Tailwind utilities. Call procedures via `trpc.*.useQuery` or `trpc.*.useMutation`. Register the route in `client/src/App.tsx`.

---

## 4. Schema migration workflow

Schema migrations are the highest-risk operation in the codebase. Follow this process exactly.

1. Edit `drizzle/schema.ts` with your changes.
2. Run `pnpm drizzle-kit generate`. This produces a new `.sql` file in `drizzle/` with a sequential name (e.g., `0004_your_migration.sql`).
3. Read the generated SQL carefully. Verify it does what you expect. Drizzle sometimes generates unexpected `ALTER TABLE` statements for enum changes.
4. Create a migration runner script at `scripts/migrate000N.mjs` (copy the pattern from an existing script).
5. Run `node scripts/migrate000N.mjs` to apply the migration.
6. Verify the migration applied correctly by checking the table structure.
7. Commit both `drizzle/schema.ts` and the new `.sql` file together.

**Never apply migrations manually via SQL without a corresponding schema change.** The TypeScript schema is the source of truth. If the database diverges from the schema, Drizzle queries will produce incorrect results.

**Never modify existing migration files.** If a migration was wrong, write a new migration to correct it.

---

## 5. Authorization rules

Every procedure must be assigned the correct authorization tier. The rule is:

| Tier | Use when |
|---|---|
| `publicProcedure` | Reading approved, publicly visible content |
| `protectedProcedure` | Any write operation by a regular user (story submission) |
| `adminProcedure` | Any moderation, upload, AI, user management, or audit operation |

When in doubt, use a more restrictive tier. It is easier to relax a restriction than to discover that a procedure was under-protected.

---

## 6. Audit logging

Every security-relevant action must write an audit entry via `writeAudit()` from `server/db.ts`. The following actions are always audited:

- Story submission (`story_submitted`)
- Story moderation decisions (`story_approved`, `story_rejected`, `story_changes_requested`)
- Document upload (`document_uploaded`)
- Document ingest (`document_ingested`)
- Document moderation decisions (`document_approved`, `document_rejected`)
- Visibility changes (`visibility_changed`)
- AI policy changes (`ai_policy_changed`)
- Admin role changes (`admin_role_changed`)
- Upload rejections (`upload_rejected`)
- Rate limit triggers (`rate_limit_triggered`)

When adding a new security-relevant action, add it to the `action` enum in `drizzle/schema.ts` first, then generate and apply a migration, then use it in `writeAudit()`.

---

## 7. Upload guard

Any procedure that accepts file uploads must call `validateUpload()` from `server/_uploadGuard.ts` before writing to storage. The guard enforces MIME allow-list, magic-byte validation, size limits, and filename safety. It is not optional.

```typescript
import { validateUpload } from "./_uploadGuard";

// In your procedure:
const guard = validateUpload(fileBuffer, declaredMimeType, filename, fileSize);
if (!guard.ok) {
  await writeAudit({ action: "upload_rejected", metadata: { reason: guard.reason, filename } });
  throw new TRPCError({ code: "BAD_REQUEST", message: guard.reason });
}
```

---

## 8. AI policy enforcement

Docket Goblin's write scope is strictly limited to:

- `documents.aiSummary`
- `documents.aiTags`
- `ingest_jobs.draftJson`

Goblin procedures must never write to `publicStatus`, `reviewStatus`, `visibility`, `aiPolicy`, or any field on the `stories` table. This is not enforced by a framework-level guard — it is enforced by convention and by tests. If you add a new Goblin procedure, add a test that verifies it does not write to publication fields.

---

## 9. Email templates

Email templates are defined in `server/_email.ts`. All templates must be redaction-safe. They must not include:

- Document text or file names
- Case details or case numbers
- Submitter names, email addresses, or contact information
- Admin reviewer notes

Templates should include only: the event type, a reference ID, and a link to the platform's public URL. When adding a new email template, add a corresponding test that verifies the template body does not contain sensitive field names.

---

## 10. Testing requirements

Every feature must have Vitest coverage before it is considered complete. The test file is `server/renoRecord.test.ts`. The current suite has 41 tests.

The minimum test requirements for any new feature are:

- **Authorization:** Verify that `publicProcedure` calls work without auth, `protectedProcedure` calls fail without auth, and `adminProcedure` calls fail for non-admin users.
- **Happy path:** Verify the procedure returns the expected result for a valid input.
- **Rejection path:** Verify the procedure returns the expected error for invalid input.
- **Audit:** If the procedure writes an audit entry, verify the entry is written with the correct `action` and `metadata`.
- **AI policy:** If the procedure involves Goblin, verify it does not write to publication fields.

Run the full suite before every commit:

```bash
pnpm test
```

All 41 existing tests must continue to pass. Do not modify existing tests to make new code pass — fix the code.

---

## 11. Code style

The project uses TypeScript in strict mode. The following conventions are enforced:

- **No `any` types** in server code. Use `unknown` and narrow explicitly.
- **No hardcoded strings** for enum values. Import the type from `drizzle/schema.ts`.
- **No direct `fetch` or `axios` calls** in frontend components. Use `trpc.*.useQuery` or `trpc.*.useMutation`.
- **No `console.log` in production paths.** Use `console.warn` for recoverable issues and `console.error` for failures. Prefix with `[module-name]`.
- **No inline styles.** Use Tailwind utilities or CSS variables defined in `client/src/index.css`.
- **No hardcoded colors.** Use the design token variables (`--color-ink`, `--color-paper`, `--color-amber`, etc.) defined in `index.css`.

Run the formatter before committing:

```bash
pnpm format
```

---

## 12. Pull request checklist

Before opening a pull request, verify:

- [ ] `pnpm test` passes with all 41+ tests green
- [ ] `pnpm check` (TypeScript) reports 0 errors
- [ ] `pnpm format` has been run
- [ ] Any new schema changes have a corresponding migration file and runner script
- [ ] Any new procedures have the correct authorization tier
- [ ] Any new security-relevant actions write an audit entry
- [ ] Any new file upload paths call `validateUpload()`
- [ ] Any new Goblin procedures do not write to publication fields
- [ ] Any new email templates are redaction-safe and have a test
- [ ] `todo.md` has been updated with the new feature marked `[x]`
- [ ] The PR description explains what changed and why

---

## 13. File structure reference

```
client/
  src/
    pages/          ← Page-level components (one file per route)
    components/     ← Reusable UI components and shadcn/ui
    contexts/       ← React contexts (ThemeContext, etc.)
    hooks/          ← Custom hooks
    lib/trpc.ts     ← tRPC client binding
    App.tsx         ← Route definitions
    index.css       ← Design tokens and global styles
drizzle/
  schema.ts         ← Source of truth for all tables and types
  *.sql             ← Generated migration files (do not edit)
server/
  _core/            ← Framework plumbing (do not edit)
  _email.ts         ← Email templates and transport
  _goblin.ts        ← Docket Goblin chat + ingest logic
  _uploadGuard.ts   ← Upload validation (MIME, magic bytes, size, rate limit)
  db.ts             ← Database query helpers
  routers.ts        ← tRPC procedures
  renoRecord.test.ts ← Vitest test suite
scripts/
  seed.mjs          ← Initial data seed
  migrate000N.mjs   ← Migration runner scripts
docs/
  README.md
  WHITEPAPER.md
  ARCHITECTURE.md
  API_REFERENCE.md
  DATA_DICTIONARY.md
  SECURITY.md
  DEPLOYMENT.md
  CONTRIBUTING.md
  V4_MONETIZATION.md
  STATE_REPORT.md
todo.md             ← Feature and bug tracking
```
