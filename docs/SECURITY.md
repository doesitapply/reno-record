# The Reno Record — Security Model

**Version:** 1.0 (platform release v3.5)

This document describes the threat model, security controls, and enforcement mechanisms for The Reno Record. It is intended for the operator, security reviewers, and technical contributors.

---

## 1. Threat model

The Reno Record is a public-interest accountability archive. Its threat surface is shaped by its purpose: it documents individuals in positions of institutional power, which creates adversarial conditions that most web applications do not face. The relevant threat actors and their capabilities are:

| Threat actor | Likely capability | Primary risk |
|---|---|---|
| Opportunistic attacker | Script-kiddie, automated scanners | File upload abuse, spam submissions |
| Targeted attacker (subject of coverage) | Motivated, potentially resourced | Injecting false evidence, defacing the record, DoS |
| Malicious submitter | Authenticated user | Uploading malware disguised as evidence, submitting fabricated records |
| Compromised admin account | Full platform access | Publishing false records, deleting audit trail, leaking submitter PII |
| Legal adversary | Subpoena, discovery demand | Exposure of submitter identities, unpublished draft content |

The security model is designed to address each of these. The platform does not attempt to prevent all possible attacks — it is designed to detect, log, and limit the blast radius of any successful attack.

---

## 2. Authentication and authorization

### 2.1 Authentication

All authentication is delegated to Manus OAuth. The platform does not store passwords, manage credentials, or implement its own login flow. The session is maintained via an `HttpOnly; Secure; SameSite=None` cookie signed with `JWT_SECRET`. The cookie cannot be read by JavaScript and is not transmitted over HTTP.

Session verification occurs on every request to `/api/trpc` in `server/_core/context.ts`. An expired or tampered JWT results in `ctx.user = null` and any `protectedProcedure` or `adminProcedure` call returns `UNAUTHORIZED`.

### 2.2 Authorization tiers

Three tiers are enforced at the procedure level in `server/_core/trpc.ts`:

- `publicProcedure` — no authentication required. Used for public reads (approved stories, public documents, timeline, actors, PRRs, pattern metrics).
- `protectedProcedure` — requires a valid session. Used for story submission. Enforces that the submitter is a real authenticated user.
- `adminProcedure` — requires `ctx.user.role === "admin"`. Used for all moderation, upload, Goblin, user management, and audit procedures.

There is no way to call an `adminProcedure` without being authenticated as an admin. The check is in middleware, not in the procedure body, so it cannot be bypassed by a procedure-level bug.

### 2.3 Admin lockout protection

An admin cannot remove their own admin role. The `user.setRole` procedure checks `input.userId !== ctx.user.id` before applying any role downgrade. If this check fails, the procedure returns `BAD_REQUEST` with the message `"Cannot remove your own admin role"`. This is tested in `server/renoRecord.test.ts`.

---

## 3. Upload security

All file uploads pass through `server/_uploadGuard.ts` before any storage write. The guard is called from `story.submit`, `document.adminUpload`, and `docketGoblin.ingest`. It cannot be bypassed by any of these procedures.

### 3.1 MIME allow-list

Only the following MIME types are accepted:

| MIME type | Extension | Use case |
|---|---|---|
| `application/pdf` | .pdf | Court orders, motions, transcripts |
| `image/png` | .png | Screenshots, scanned documents |
| `image/jpeg` | .jpg/.jpeg | Photographs, scanned documents |
| `image/webp` | .webp | Modern image format |
| `image/gif` | .gif | Animated or static images |
| `audio/mpeg` | .mp3 | Audio recordings |
| `audio/wav` | .wav | Audio recordings |
| `video/mp4` | .mp4 | Video recordings |
| `video/webm` | .webm | Video recordings |
| `text/plain` | .txt | Plain text documents |
| `text/markdown` | .md | Markdown documents |
| `application/msword` | .doc | Legacy Word documents |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx | Modern Word documents |

Any file with a MIME type not on this list is rejected with `BAD_REQUEST: "File type not allowed"` and an `upload_rejected` audit entry.

### 3.2 Magic-byte validation

Declaring a MIME type is not sufficient. A malicious actor can rename `malware.exe` to `evidence.pdf` and the declared MIME type will be `application/pdf`. The upload guard reads the first 16 bytes of every uploaded file and compares them against known magic byte signatures for each allowed MIME type.

The magic byte signatures checked are:

| MIME type | Magic bytes (hex) |
|---|---|
| `application/pdf` | `25 50 44 46` (%PDF) |
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` |
| `image/jpeg` | `FF D8 FF` |
| `image/webp` | `52 49 46 46` (RIFF) |
| `image/gif` | `47 49 46 38` (GIF8) |
| `audio/mpeg` | `49 44 33` (ID3) or `FF FB` |
| `audio/wav` | `52 49 46 46` (RIFF) |
| `video/mp4` | `00 00 00 18 66 74 79 70` or `00 00 00 20 66 74 79 70` |
| `video/webm` | `1A 45 DF A3` |
| `application/msword` | `D0 CF 11 E0` (OLE2) |
| `application/vnd...docx` | `50 4B 03 04` (ZIP/OOXML) |

Text files (`text/plain`, `text/markdown`) are exempt from magic-byte checking because they have no reliable signature. They are accepted based on MIME type alone.

Files that fail magic-byte validation are rejected with `BAD_REQUEST: "File content does not match declared type"` and an `upload_rejected` audit entry with `metadata.reason: "magic_byte_mismatch"`.

### 3.3 Size limits

- Maximum file size: **15 MB** per file.
- Maximum files per story submission: **10 files**.

Files exceeding the size limit are rejected with `BAD_REQUEST: "File too large"`. Submissions exceeding the file count limit are rejected with `BAD_REQUEST: "Too many files"`.

### 3.4 Filename validation

Filenames are checked for path-traversal characters: `..`, `/`, `\`, and null bytes. Files with invalid filenames are rejected with `BAD_REQUEST: "Invalid filename"`.

### 3.5 Rate limiting

Rate limits are enforced per authenticated user ID, not per IP. This means VPN rotation or IP spoofing does not bypass the limit.

| Operation | Limit | Window |
|---|---|---|
| Story submission | 3 per user | 24 hours |
| Goblin ingest | 30 per admin | 24 hours |

Rate limit enforcement queries the `stories` table (for submissions) and `ingest_jobs` table (for ingest) to count recent operations. When a limit is exceeded, the procedure returns `BAD_REQUEST: "Rate limit exceeded"` and writes a `rate_limit_triggered` audit entry.

---

## 4. Content publication gating

No content is published without explicit admin action. This is enforced at the database query level, not the UI level.

### 4.1 Story publication

The `story.listApproved` and `story.bySlug` procedures filter on `status = "approved" AND publicPermission = true`. A story with `status: "approved"` but `publicPermission: false` is not returned by any public query. The admin must explicitly set both fields.

### 4.2 Document publication

The `document.listPublic` and `document.byId` procedures filter on `reviewStatus = "approved" AND publicStatus = true`. A document with `reviewStatus: "approved"` but `publicStatus: false` is not returned by any public query.

Additionally, the 7-state `visibility` field provides fine-grained control. Documents in `pending_review`, `needs_redaction`, `private_admin_only`, or `rejected` states are never returned by public queries regardless of `reviewStatus` or `publicStatus`.

### 4.3 Default states

Every submitted story and every uploaded document defaults to the most restrictive state:

| Field | Default | Meaning |
|---|---|---|
| `stories.status` | `pending` | Not approved |
| `stories.publicPermission` | `false` | Not public |
| `documents.reviewStatus` | `pending` | Not approved |
| `documents.publicStatus` | `false` | Not public |
| `documents.visibility` | `pending_review` | Admin-only |
| `documents.aiPolicy` | `no_ai_processing` | Goblin cannot read |

There is no automated promotion path. Every transition to a public state requires an explicit admin action.

---

## 5. AI policy enforcement

Docket Goblin's archive context is filtered server-side before being passed to the LLM. The filter is in `server/db.ts:getArchiveContextForLLM()` and cannot be bypassed by the chat prompt.

The filter excludes:
- Documents where `aiPolicy = "no_ai_processing"` (the default for all documents)
- Documents where `visibility IN ("private_admin_only", "rejected")`

This means:
- A document can be publicly visible (`visibility: "public_preview"`) but still excluded from Goblin's context if `aiPolicy: "no_ai_processing"`. The admin must explicitly opt the document into AI processing.
- A document can be opted into AI processing (`aiPolicy: "goblin_allowed"`) but still not be public. The two flags are independent.

Docket Goblin has no write access to `publicStatus`, `reviewStatus`, `visibility`, or `aiPolicy` fields. Its write scope is limited to `documents.aiSummary`, `documents.aiTags`, and `ingest_jobs.draftJson`. This is enforced in the procedure bodies, not in the prompt.

---

## 6. Audit log

The audit log is the primary accountability mechanism for the platform itself. Every security-relevant action is recorded with:

- `actorUserId` — who did it
- `actorRole` — their role at the time
- `action` — what they did (one of 13 enum values)
- `targetType` / `targetId` — what they did it to
- `metadata` — old/new values, email outcome, file details
- `ipHash` — SHA-256 of the actor's IP address (not reversible)
- `createdAt` — when it happened

The audit log is append-only. There is no delete or update procedure. An admin who deletes records from the database directly will leave a gap in the sequential IDs that is detectable.

The admin can view, filter, search, and export the audit log as CSV via the Audit tab in the admin panel. The export is admin-only and is not paginated — it returns all matching rows up to 10,000.

---

## 7. Submitter privacy

Submitter identity is protected from public exposure:

- Submitter name, email, and phone are stored in the `stories` table but are never returned by any public procedure.
- Approved stories are published without the submitter's name unless they explicitly include it in the narrative.
- The `submitter_ip_hash` column stores a SHA-256 hash of the submitter's IP address. The raw IP is never stored.
- Email addresses are never included in email notification templates.

The platform does not implement a submitter-facing account portal. Submitters cannot view their own submission status without contacting the admin directly. This is a deliberate privacy tradeoff: a submitter portal would require storing more session state and create a larger attack surface for deanonymization.

---

## 8. SMTP and email security

Email templates are designed to be redaction-safe. They contain:
- The event type (e.g., "Your story has been received")
- A reference ID (the story or document ID)
- A link to the platform's public URL

They do not contain:
- Document text or file names
- Case details or case numbers
- Submitter names or contact information
- Admin notes or reviewer feedback

This means that even if an email is intercepted or forwarded, it reveals nothing about the content of the submission.

SMTP credentials are stored as environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). They are never hardcoded in source code. If any of these variables are missing, all email functions fail gracefully and log `[email] SMTP env missing — email skipped at runtime`. The application continues normally.

---

## 9. Dependency and infrastructure security

The platform runs on Manus-managed CloudRun infrastructure. The operator does not manage the underlying VM, OS, or network security. The following application-level controls are in place:

- All dependencies are pinned to specific versions in `package.json` and `pnpm-lock.yaml`.
- The Express server does not expose any debug endpoints in production (`NODE_ENV=production`).
- The tRPC adapter is mounted only at `/api/trpc`. There are no wildcard route handlers that could expose internal endpoints.
- The S3 storage proxy at `/manus-storage/*` generates presigned URLs with short expiry. It does not expose the underlying S3 bucket URL or credentials.

---

## 10. Incident response

If a security incident is suspected:

1. **Audit log first.** The audit log is the authoritative record. Filter by the suspected actor, time range, and action type. Export as CSV for offline analysis.
2. **Revoke the compromised account.** Use the Users tab in the admin panel to set the compromised user's role to `user`. This immediately blocks all admin procedures.
3. **Assess published content.** Review the Documents and Stories tabs for any content that should not have been published. Set `publicStatus: false` and `visibility: "private_admin_only"` on affected records.
4. **Rotate secrets.** If admin credentials or JWT secret are suspected to be compromised, rotate `JWT_SECRET` via the platform secrets panel. This invalidates all existing sessions.
5. **Contact Manus support.** For infrastructure-level incidents (CloudRun, S3, database), contact Manus support at https://help.manus.im.
