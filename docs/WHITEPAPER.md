# The Reno Record — Technical and Editorial Whitepaper

**Version:** 1.0 (corresponds to platform release v3.5)
**Status:** Public distribution authorized
**Jurisdiction documented:** Washoe County, Nevada

---

## Abstract

The Reno Record is a public-interest investigative archive built to document, structure, and publish evidence of procedural failures in the Washoe County legal system. It is not a legal service, a news organization, or a social platform. It is a structured evidence repository with an editorial layer — every document is reviewed before publication, every claim is anchored to a source record, and every action taken on the platform is logged to an immutable audit trail.

This whitepaper describes the platform's mission, editorial model, technical architecture, security design, data governance principles, AI policy, and monetization roadmap. It is intended for journalists, researchers, attorneys, potential subscribers, and technical collaborators who need to understand how the platform works and what guarantees it makes.

---

## 1. Mission

The American legal system depends on procedural integrity. When courts delay hearings beyond constitutional limits, when filings go unacknowledged, when defendants are held pretrial for months without adjudication, and when self-represented litigants are denied basic procedural access, the harm is real and the record is often invisible. Washoe County, Nevada has produced a documented pattern of such failures. The Reno Record exists to make that pattern visible.

The platform's mission is narrow and specific:

> Document procedural failures in Washoe County courts using primary source evidence — court filings, orders, docket entries, public records responses, and sworn accounts — and publish that record in a form that is searchable, citable, and permanently accessible.

The platform does not adjudicate guilt or innocence. It does not editorialize on outcomes. It does not publish unverified claims. The Election and Accountability page is explicitly constrained to neutral, public-record-based information. The AI assistant is constrained to drafting structural metadata — it cannot publish, approve, or modify any record.

---

## 2. Editorial model

### 2.1 Submission pipeline

Any authenticated user may submit a story. Submission requires:

- A valid Manus account (OAuth-authenticated)
- Explicit consent to the platform's terms of use
- Explicit acknowledgment that submitted content may be published if approved

Submitted stories and documents default to `reviewStatus: "pending"` and `publicStatus: false`. They are not visible to any public user, any subscriber, or the AI assistant until an admin takes an explicit approval action. This is enforced at the database procedure level, not the UI layer.

### 2.2 Moderation workflow

The admin moderation queue presents every pending story and document with full metadata, uploaded files, and the Docket Goblin's draft summary and tags (if the document's AI policy permits). The admin can:

- **Approve** — sets `reviewStatus: "approved"` and optionally sets `publicStatus: true` and `documentVisibility` to a public-facing state
- **Reject** — sets `reviewStatus: "rejected"` and `documentVisibility: "rejected"`; submitter is notified by email
- **Request changes** — sets `reviewStatus: "needs_changes"`; submitter is notified with a note

Every moderation action is written to the audit log with the actor's user ID, role, timestamp, IP hash, and the old/new values of changed fields.

### 2.3 Document visibility states

Documents have seven visibility states, each with a precise meaning:

| State | Visible to | Purpose |
|---|---|---|
| `pending_review` | Admin only | Default for all newly uploaded documents |
| `needs_redaction` | Admin only | Admin has flagged for redaction before any publication |
| `private_admin_only` | Admin only | Permanently restricted; never to be published |
| `public_preview` | Everyone (free) | Full content, no subscription required |
| `receipts_only` | Subscribers (v4+) | Full content, requires Receipts tier subscription |
| `goblin_allowed` | Admin + Goblin AI | Admin has opted this document into AI processing |
| `rejected` | Admin only | Rejected by admin; not to be published |

No document transitions from any state to a public-facing state without an explicit admin action. There is no automated promotion path.

### 2.4 AI policy

Every document carries an `aiPolicy` field that defaults to `no_ai_processing`. Docket Goblin's archive context query explicitly filters out any document where `aiPolicy != "goblin_allowed"` or `visibility IN ("private_admin_only", "rejected")`. This means:

- A document can be `public_preview` but still have `aiPolicy: "no_ai_processing"` — Goblin cannot read it.
- A document can be `goblin_allowed` but `visibility: "pending_review"` — Goblin can read it but it is not public.
- The two flags are independent and both must be explicitly set by an admin.

This design reflects a real-world constraint: some documents contain sensitive personal information that is appropriate for public accountability but inappropriate for AI training or processing. The platform gives the admin granular control over both dimensions.

---

## 3. Technical architecture

The Reno Record is a monorepo full-stack application. The frontend and backend are served from the same Node.js process in production, eliminating CORS complexity and simplifying deployment.

### 3.1 Request flow

```
Browser
  └─► Manus CDN / CloudRun ingress
        └─► Express 4 server (port 3000)
              ├─► /api/trpc/*   → tRPC router (all application logic)
              ├─► /api/oauth/*  → Manus OAuth callbacks
              ├─► /manus-storage/* → S3 presigned redirect proxy
              └─► /*            → Vite-built React SPA (static)
```

All application logic lives in tRPC procedures. There are no ad-hoc REST routes for application features. This means every endpoint is type-safe end-to-end: the TypeScript types defined in `server/routers.ts` are consumed directly by the React frontend via `client/src/lib/trpc.ts` with no intermediate contract files.

### 3.2 Authentication

Authentication uses Manus OAuth. The flow:

1. Frontend redirects to `VITE_OAUTH_PORTAL_URL` with a state parameter encoding `window.location.origin` and the return path.
2. Manus OAuth completes and redirects to `/api/oauth/callback`.
3. The callback handler verifies the token, upserts the user record, signs a session JWT, and sets an `HttpOnly; Secure; SameSite=None` cookie.
4. Every subsequent request to `/api/trpc` builds context via `server/_core/context.ts`, which verifies the session cookie and injects `ctx.user`.
5. `protectedProcedure` requires `ctx.user` to be non-null. `adminProcedure` additionally requires `ctx.user.role === "admin"`.

The project owner's `OWNER_OPEN_ID` is automatically promoted to `admin` role on first sign-in via the `upsertUser` helper in `server/db.ts`.

### 3.3 Data layer

The database is MySQL/TiDB. Drizzle ORM provides type-safe query building with no code generation step at runtime. The schema is the single source of truth: `drizzle/schema.ts` defines all tables, columns, enums, and indexes. Migrations are generated via `pnpm drizzle-kit generate` and applied via `pnpm drizzle-kit migrate`.

There are four applied migrations:

| Migration | Content |
|---|---|
| `0000_handy_wolverine.sql` | Initial users table |
| `0001_special_supernaut.sql` | Stories, documents, timeline, actors, PRRs, agent tasks |
| `0002_condemned_spiral.sql` | Chat sessions, chat messages, ingest jobs |
| `0003_amused_mattie_franklin.sql` | Audit log, visibility/aiPolicy/owner columns on documents and stories |

### 3.4 File storage

All uploaded files are stored in S3-compatible object storage via the `storagePut` helper in `server/storage.ts`. File bytes are never stored in the database. The database stores only the `fileKey` (S3 object key) and the `fileUrl` (relative path `/manus-storage/{key}`). The Manus runtime serves S3 objects via a presigned redirect proxy at `/manus-storage/*`.

### 3.5 AI pipeline (Docket Goblin)

The Docket Goblin ingest pipeline processes uploaded evidence documents through four stages:

1. **Validate** — `_uploadGuard.validateUpload()` checks MIME type, magic bytes, file size, and rate limit.
2. **Extract** — `pdf-parse` extracts text from PDFs. Other MIME types use filename + metadata only.
3. **Draft** — `invokeLLM()` is called with a structured JSON schema response format. The prompt instructs the model to produce: title, summary, source type, case number, document date, actor names, tags, and a proposed timeline event. The model is explicitly instructed to be neutral and factual.
4. **Stage** — The draft is written to `ingest_jobs.draftJson`. A pending document record is created with `publicStatus: false`, `reviewStatus: "pending"`, `visibility: "pending_review"`, and `aiPolicy: "no_ai_processing"`. Nothing is published.

The admin reviews the draft in the Ingest tab of the admin panel and clicks "Approve" to promote the document. The `approveIngest` procedure is the only path from a Goblin draft to a published document, and it still requires the admin to explicitly set `publishDocument: true`.

### 3.6 Email

Email uses Nodemailer with a lazy transport initialization. The transport is created only when the first email is sent. If `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` are missing from the environment, all email functions return `{ sent: false, reason: "smtp_not_configured" }` without throwing. The application logs `[email] SMTP env missing — email skipped at runtime` and continues normally.

Four email events are triggered:

- **Story received** — sent to the submitter when their story is successfully submitted
- **Files received** — sent to the submitter when file attachments are successfully uploaded
- **Story decision** — sent to the submitter when an admin approves, rejects, or requests changes on their story
- **Document decision** — sent to the uploader when an admin approves or rejects a document

All email templates are redaction-safe: they contain no document text, no file names, no case details. They contain only the event type, a reference ID, and a link to the platform.

---

## 4. Security model

The security model is described in full in [SECURITY.md](./SECURITY.md). The key guarantees are:

**Upload security.** Every file upload passes through `_uploadGuard.validateUpload()` before any storage write. The guard checks: MIME type against a strict allow-list, magic bytes (first 16 bytes of the file) against the declared MIME type to detect renamed executables, file size (15 MB hard cap), file count per submission (10 max), and filename for path-traversal characters. Files that fail any check are rejected with a `400 BAD_REQUEST` and an audit log entry.

**Rate limiting.** Authenticated users are limited to 3 story submissions per 24 hours. Admin ingest operations are limited to 30 per 24 hours. Rate limits are enforced per user ID in the database, not per IP, so VPN rotation does not bypass them.

**Audit log.** Every security-relevant action writes to `audit_log` with actor, role, target, timestamp, IP hash (SHA-256, not reversible), and metadata. The audit log is append-only. There is no delete procedure. The admin can view, filter, search, and export the audit log as CSV.

**Admin lockout protection.** An admin cannot remove their own admin role. The `user.setRole` procedure checks `input.userId !== ctx.user.id` before applying any role downgrade.

**AI policy enforcement.** Docket Goblin's archive context query is filtered server-side. Documents with `aiPolicy: "no_ai_processing"` or `visibility IN ("private_admin_only", "rejected")` are excluded from the context passed to the LLM. This is enforced in `server/db.ts:getArchiveContextForLLM()`, not in the prompt.

---

## 5. Data governance

### 5.1 What is stored

The platform stores: user account data (Manus OAuth ID, name, email, login method, role), submitted stories (narrative text, procedural posture flags, harm description, case number, consent timestamps), uploaded documents (S3 key, MIME type, file size, extracted text, AI-generated summary and tags, visibility and AI policy flags), timeline events, actor profiles, public records request tracking, chat session history (admin only), ingest job drafts, and the audit log.

### 5.2 What is not stored

The platform does not store: passwords (Manus OAuth handles authentication), payment information (Stripe handles this in v4), raw IP addresses (only SHA-256 hashes), document file bytes in the database (S3 only), or any content from documents flagged `no_ai_processing` in the LLM context.

### 5.3 Submitter privacy

Submitters are identified by their Manus account. Their identity is visible to admins but not to the public. Approved stories are published without the submitter's name unless they explicitly include it in the narrative. The platform does not publish submitter email addresses under any circumstance.

### 5.4 Redaction workflow

Documents flagged `needs_redaction` by an admin are held in a private state until the admin completes redaction and re-uploads a redacted version. The original unredacted file remains in S3 under the original key. The redacted version is uploaded as a new document with a new key. The original is not deleted — it remains as an admin-only record. This is intentional: the original is evidence of what was submitted.

---

## 6. AI policy statement

The Reno Record uses AI in exactly one context: the Docket Goblin ingest pipeline. The following constraints are absolute and enforced in code:

1. Docket Goblin cannot publish any content. It has no write access to `publicStatus` or `reviewStatus` fields.
2. Docket Goblin cannot read documents flagged `no_ai_processing`. This is enforced server-side in the archive context query.
3. Docket Goblin cannot read documents flagged `private_admin_only` or `rejected`. Same enforcement.
4. Docket Goblin's outputs (title, summary, tags, proposed timeline event) are stored as drafts in `ingest_jobs.draftJson` and `documents.aiSummary` / `documents.aiTags`. They are advisory metadata, not published content.
5. The admin reviews every Goblin draft before any approval. There is no automated approval path.
6. The LLM prompt instructs the model to be neutral and factual. The model is given no instructions that would produce advocacy, editorialization, or legal conclusions.

The platform does not use AI for moderation decisions, content ranking, user profiling, or any other purpose.

---

## 7. Monetization roadmap

The full v4 monetization spec is in [V4_MONETIZATION.md](./V4_MONETIZATION.md). The summary:

The public accountability layer is and will remain free. The Receipts tier ($9/month or $90/year) unlocks the full evidence archive for subscribers. Goblin Pro ($29/month) adds AI chat and self-upload capabilities. Founding lifetime tiers ($250 and $500, capped) provide permanent access for early supporters. Credit packs allow burst usage without a subscription.

No Stripe code is implemented in the current release. The v4 build begins after the operator answers the 12 open questions in the spec and provides Stripe credentials.

---

## 8. Limitations and known gaps

The following are real limitations of the current release, documented honestly:

**Actor detail pages** do not yet aggregate related events and related documents in a single view. The data is in the database; the UI does not yet surface it.

**Admin CRUD** for timeline events, actors, and public records requests requires direct database access or the seed script. There is no browser-based creation UI for these entities yet.

**Public Records Tracker** shows status badges but not a per-request status history timeline.

**SEO** meta tags are generic across pages. Per-page title, description, and Open Graph tags are not yet implemented.

**Mobile** has not received a dedicated QA pass.

**SMTP** is wired and fail-safe but has not been tested against a live mail server in the current deployment.

These gaps are tracked in `todo.md` and will be addressed in subsequent releases.

---

## 9. Contact and reporting

The Reno Record is operated by Cameron. To submit a story, use the Submit Your Story form at `/submit` (requires a Manus account). To report a technical issue, contact the operator directly. To report a legal concern about published content, use the contact information on the Privacy page.

The platform does not accept anonymous submissions. All submitters must authenticate via Manus OAuth. This is a deliberate security and accountability decision: the platform documents accountability failures; it must itself be accountable.
