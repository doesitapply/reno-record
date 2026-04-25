# The Reno Record — tRPC API Reference

**Version:** 1.0 (platform release v3.5)

All application logic is exposed through tRPC procedures at `/api/trpc`. There are no ad-hoc REST endpoints for application features. Procedures are called from the React frontend via the tRPC React Query client (`client/src/lib/trpc.ts`). External callers (e.g., scheduled tasks, scripts) can call procedures using the tRPC HTTP client with the session cookie for authentication.

---

## Authentication tiers

| Tier | Symbol | Requirement |
|---|---|---|
| Public | `[public]` | No authentication required |
| Protected | `[protected]` | Valid session cookie (any authenticated user) |
| Admin | `[admin]` | Valid session cookie + `user.role === "admin"` |

Procedures that require authentication return `UNAUTHORIZED` (401) if the session is missing or expired. Admin procedures return `FORBIDDEN` (403) if the user is authenticated but not an admin.

---

## `auth` router

### `auth.me` `[public]`

Returns the current user record if authenticated, or `null` if not.

**Output:** `User | null`

```typescript
type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}
```

### `auth.logout` `[public]`

Clears the session cookie. Safe to call when not authenticated.

**Output:** `{ success: true }`

**Audit:** None (logout is not a security-relevant event in the current model).

---

## `story` router

### `story.submit` `[protected]`

Submits a new story. Requires both consent flags. Enforces a rate limit of 3 submissions per 24 hours per user.

**Input:**
```typescript
{
  title: string;
  slug: string;                    // URL-safe identifier
  summary: string;
  body: string;                    // Full narrative
  caseNumber?: string;
  courtName?: string;
  filingDate?: Date;
  issueTags?: string[];
  proceduralPosture?: string[];    // Array of posture flags
  harmDescription?: string;
  consentToPublish: boolean;       // Must be true
  consentToTerms: boolean;         // Must be true
  files?: Array<{                  // Optional attachments
    filename: string;
    mimeType: string;
    base64: string;                // Base64-encoded file bytes
    size: number;
  }>;
}
```

**Output:** `{ storyId: number; documentIds: number[] }`

**Audit:** `story_submitted` (with `ownerUserId`, `consentToPublish`, `consentToTerms`, `fileCount`). Each file that fails validation writes `upload_rejected`. Rate limit trigger writes `rate_limit_triggered`.

**Errors:**
- `BAD_REQUEST` — missing consent flags, rate limit exceeded, file validation failure

### `story.listApproved` `[public]`

Returns all stories where `reviewStatus === "approved"` and `publicStatus === true`.

**Output:** `Array<{ id, title, slug, summary, caseNumber, courtName, featured, createdAt }>`

### `story.featured` `[public]`

Returns the single story marked `featured: true`, or `null`.

**Output:** `{ id, title, slug, summary, body, caseNumber, courtName, createdAt } | null`

### `story.bySlug` `[public]`

Returns a single approved public story by slug.

**Input:** `{ slug: string }`

**Output:** Full story record (same shape as `featured`) or `null` if not found or not public.

### `story.adminList` `[admin]`

Returns all stories regardless of status. Used by the moderation queue.

**Output:** `Array<Story>` (full records including `reviewStatus`, `publicStatus`, `ownerUserId`)

### `story.adminGet` `[admin]`

Returns a single story by ID.

**Input:** `{ id: number }`

**Output:** `Story | undefined`

### `story.adminUpdate` `[admin]`

Updates a story's moderation state and/or content. Triggers decision email if `status` changes to `approved`, `rejected`, or `needs_changes`.

**Input:**
```typescript
{
  id: number;
  patch: {
    status?: "pending" | "approved" | "rejected" | "needs_changes";
    publicPermission?: boolean;
    featured?: boolean;
    reviewNote?: string;
    title?: string;
    summary?: string;
    body?: string;
  }
}
```

**Output:** `{ ok: true }`

**Audit:** `story_approved` | `story_rejected` | `story_changes_requested` (with `metadata.email` = `email_sent` | `email_skipped:{reason}`)

---

## `document` router

### `document.listPublic` `[public]`

Returns documents where `reviewStatus === "approved"` and `publicStatus === true`. Supports optional search and source type filter.

**Input:** `{ q?: string; sourceType?: string }`

**Output:** `Array<{ id, title, description, sourceType, caseNumber, documentDate, fileUrl, mimeType, issueTags, aiSummary, aiTags, createdAt }>`

### `document.byId` `[public]`

Returns a single document by ID. Returns `null` if the document is not publicly visible.

**Input:** `{ id: number }`

**Output:** Document record or `null`

### `document.adminList` `[admin]`

Returns all documents. Accepts optional filters.

**Input:** `{ visibility?: DocumentVisibility; aiPolicy?: AiPolicy }`

**Output:** `Array<Document>` (full records)

### `document.adminCounts` `[admin]`

Returns counts grouped by `documentVisibility` state. Used by the visibility counter strip in the admin Documents tab.

**Output:**
```typescript
{
  pending_review: number;
  needs_redaction: number;
  private_admin_only: number;
  public_preview: number;
  receipts_only: number;
  goblin_allowed: number;
  rejected: number;
}
```

### `document.adminGet` `[admin]`

Returns a single document by ID (full record, all fields).

**Input:** `{ id: number }`

**Output:** `Document | undefined`

### `document.adminUpload` `[admin]`

Uploads a document directly from the admin panel. Validates the file through `_uploadGuard`. Creates the document record with `publicStatus: false`, `reviewStatus: "pending"`, `visibility: "pending_review"`, `aiPolicy: "no_ai_processing"`.

**Input:**
```typescript
{
  filename: string;
  mimeType: string;
  base64: string;
  size: number;
  title?: string;
  description?: string;
  sourceType?: string;
  caseNumber?: string;
  storyId?: number;
}
```

**Output:** `{ documentId: number }`

**Audit:** `document_uploaded`

### `document.adminUpdate` `[admin]`

Updates a document's moderation state, visibility, AI policy, or metadata. Triggers decision email if `reviewStatus` changes to `approved` or `rejected`.

**Input:**
```typescript
{
  id: number;
  patch: {
    reviewStatus?: "pending" | "approved" | "rejected" | "needs_redaction";
    publicStatus?: boolean;
    visibility?: DocumentVisibility;
    aiPolicy?: "no_ai_processing" | "goblin_allowed";
    title?: string;
    description?: string;
    issueTags?: string[];
  }
}
```

**Output:** `{ ok: true }`

**Audit:** `document_approved` | `document_rejected` | `visibility_changed` | `ai_policy_changed` (each with `metadata.email` on decision events)

---

## `timeline` router

### `timeline.listPublic` `[public]`

Returns timeline events where `publicStatus === true`, ordered by `eventDate` ascending.

**Output:** `Array<{ id, eventDate, title, summary, category, status, caseNumber, storyId, sourceDocuments, publicStatus }>`

### `timeline.adminList` `[admin]`

Returns all timeline events regardless of `publicStatus`.

**Output:** `Array<TimelineEvent>`

### `timeline.adminCreate` `[admin]`

Creates a new timeline event.

**Input:**
```typescript
{
  eventDate: Date;
  title: string;
  summary?: string;
  category: "filing" | "hearing" | "order" | "detention" | "prr" | "correspondence" | "other";
  status: "confirmed" | "alleged" | "needs_review";
  caseNumber?: string;
  storyId?: number;
  sourceDocuments?: number[];    // Array of document IDs
  publicStatus?: boolean;
}
```

**Output:** `{ id: number }`

### `timeline.adminUpdate` `[admin]`

Updates an existing timeline event.

**Input:** `{ id: number; patch: Partial<TimelineEvent> }`

**Output:** `{ ok: true }`

### `timeline.adminDelete` `[admin]`

Deletes a timeline event by ID.

**Input:** `{ id: number }`

**Output:** `{ ok: true }`

---

## `actor` router

### `actor.listPublic` `[public]`

Returns all actors where `publicStatus === true`.

**Output:** `Array<{ id, name, slug, role, institution, description, judicialActor, publicStatus }>`

### `actor.bySlug` `[public]`

Returns a single public actor by slug.

**Input:** `{ slug: string }`

**Output:** Actor record or `null`

### `actor.adminList` `[admin]`

Returns all actors.

**Output:** `Array<Actor>`

### `actor.adminCreate` `[admin]`

Creates a new actor.

**Input:**
```typescript
{
  name: string;
  slug: string;
  role: string;
  institution?: string;
  description?: string;
  judicialActor?: boolean;
  publicStatus?: boolean;
}
```

**Output:** `{ id: number }`

### `actor.adminUpdate` `[admin]`

Updates an existing actor.

**Input:** `{ id: number; patch: Partial<Actor> }`

**Output:** `{ ok: true }`

### `actor.adminDelete` `[admin]`

Deletes an actor by ID.

**Input:** `{ id: number }`

**Output:** `{ ok: true }`

---

## `prr` router (Public Records Requests)

### `prr.listPublic` `[public]`

Returns all PRRs where `publicStatus === true`.

**Output:** `Array<{ id, agency, requestDate, subject, status, responseDate, notes, publicStatus }>`

### `prr.adminList` `[admin]`

Returns all PRRs.

**Output:** `Array<PublicRecordsRequest>`

### `prr.adminCreate` `[admin]`

Creates a new PRR record.

**Input:**
```typescript
{
  agency: string;
  requestDate: Date;
  subject: string;
  status: "pending" | "acknowledged" | "fulfilled" | "denied" | "overdue" | "appealed";
  responseDate?: Date;
  notes?: string;
  publicStatus?: boolean;
}
```

**Output:** `{ id: number }`

### `prr.adminUpdate` `[admin]`

Updates an existing PRR.

**Input:** `{ id: number; patch: Partial<PublicRecordsRequest> }`

**Output:** `{ ok: true }`

### `prr.adminDelete` `[admin]`

Deletes a PRR by ID.

**Input:** `{ id: number }`

**Output:** `{ ok: true }`

---

## `patterns` router

### `patterns.metrics` `[public]`

Returns aggregate pattern metrics for the Pattern Dashboard. All counts are derived from approved public records only.

**Output:**
```typescript
{
  totalStories: number;
  approvedStories: number;
  totalDocuments: number;
  publicDocuments: number;
  timelineEvents: number;
  publicActors: number;
  openPRRs: number;
  overdueDetentionCases: number;    // stories with detention ≥ 100 days
  speedyTrialIssues: number;
  familyHarmReports: number;
  casesOverOneYear: number;
}
```

---

## `docketGoblin` router

All Docket Goblin procedures are admin-only. The Goblin has no auto-publish capability.

### `docketGoblin.ingest` `[admin]`

Processes one or more uploaded files through the Goblin pipeline: validate → extract → LLM draft → stage as pending document. Returns job IDs and draft summaries.

**Input:**
```typescript
{
  files: Array<{
    filename: string;
    mimeType: string;
    base64: string;
    size: number;
  }>;
  storyId?: number;    // Optional: link to an existing story
}
```

**Output:**
```typescript
Array<{
  jobId: number;
  documentId: number;
  filename: string;
  draft: {
    title: string;
    summary: string;
    sourceType: string;
    caseNumber: string | null;
    documentDate: string | null;
    actorNames: string[];
    tags: string[];
    proposedTimeline: { eventDate, title, summary, category, status } | null;
    warnings: string[];
  };
}>
```

**Audit:** `document_ingested` per file. Rate limit: 30 ingests per 24 hours per admin user.

### `docketGoblin.ingestList` `[admin]`

Returns all ingest jobs, ordered by creation date descending.

**Output:** `Array<IngestJob>`

### `docketGoblin.approveIngest` `[admin]`

Approves a Goblin ingest draft. Optionally publishes the document and/or creates a timeline event from the proposed timeline.

**Input:**
```typescript
{
  jobId: number;
  approveDocument?: boolean;          // default: true
  publishDocument?: boolean;          // default: true — sets publicStatus
  createTimelineEvent?: boolean;      // default: true
  publishTimelineEvent?: boolean;     // default: true
}
```

**Output:** `{ ok: true; documentId: number; timelineEventId: number | null }`

**Audit:** `document_approved` (with `metadata.via: "approveIngest"`)

### `docketGoblin.history` `[admin]`

Returns the current admin's Goblin chat session history (most recent session).

**Output:** `Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: Date }>`

### `docketGoblin.resetChat` `[admin]`

Clears the current admin's Goblin chat session. A new session is created on the next chat message.

**Output:** `{ ok: true }`

---

## `user` router

### `user.adminList` `[admin]`

Returns all users (basic fields).

**Output:** `Array<{ id, openId, name, email, role, createdAt, lastSignedIn }>`

### `user.adminListWithCounts` `[admin]`

Returns all users with submission and upload counts. Used by the Users tab in the admin panel.

**Output:**
```typescript
Array<{
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
  storyCount: number;
  documentCount: number;
}>
```

### `user.setRole` `[admin]`

Changes a user's role. Enforces admin lockout protection: an admin cannot remove their own admin role.

**Input:** `{ userId: number; role: "user" | "admin" }`

**Output:** `{ ok: true }`

**Audit:** `admin_role_changed` (with `metadata.from`, `metadata.to`, `metadata.targetEmail`)

**Errors:**
- `BAD_REQUEST` — attempting to remove own admin role

---

## `audit` router

### `audit.list` `[admin]`

Returns filtered, paginated audit log entries.

**Input:**
```typescript
{
  actorUserId?: number;
  action?: string;          // One of the 13 audit action enum values
  targetType?: string;      // "story" | "document" | "user" | etc.
  dateFrom?: Date;
  dateTo?: Date;
  q?: string;               // Full-text search across metadata JSON
  limit?: number;           // Default: 50, max: 500
  offset?: number;          // Default: 0
}
```

**Output:**
```typescript
{
  rows: Array<{
    id: number;
    createdAt: Date;
    actorUserId: number | null;
    actorRole: string | null;
    action: AuditAction;
    targetType: string | null;
    targetId: number | null;
    metadata: Record<string, unknown> | null;
    ipHash: string | null;
  }>;
  total: number;
}
```

### `audit.exportCsv` `[admin]`

Returns a CSV string of filtered audit log entries. Accepts the same filter parameters as `audit.list` (no pagination — returns all matching rows up to 10,000).

**Input:** Same as `audit.list` (without `limit`/`offset`)

**Output:** `{ csv: string }` — CSV with headers: `id,createdAt,actorUserId,actorRole,action,targetType,targetId,metadata,ipHash`

---

## `system` router

### `system.notifyOwner` `[protected]`

Sends a notification to the platform owner via the Manus notification API.

**Input:** `{ title: string; content: string }`

**Output:** `{ sent: boolean }`

---

## Error codes

tRPC surfaces errors using standard HTTP-mapped codes:

| Code | HTTP | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Invalid input, validation failure, rate limit, consent missing |
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

All errors include a `message` field with a human-readable description. Validation errors (from Zod) include a `data.zodError` field with field-level details.

---

## Calling procedures from scripts

For scheduled tasks or administrative scripts that need to call procedures, use the tRPC HTTP client with the session cookie:

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./server/routers";

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.SCHEDULED_TASK_ENDPOINT_BASE}/api/trpc`,
      headers: {
        Cookie: `app_session_id=${process.env.SCHEDULED_TASK_COOKIE}`,
      },
    }),
  ],
});

// Example: fetch public stories
const stories = await client.story.listApproved.query();
```

The `SCHEDULED_TASK_ENDPOINT_BASE` and `SCHEDULED_TASK_COOKIE` environment variables are injected automatically into scheduled task sandboxes by the Manus platform.
