# The Reno Record — Architecture Reference

**Version:** 1.0 (platform release v3.5)

---

## 1. System overview

The Reno Record is a monorepo full-stack application. A single Node.js/Express process serves both the API and the React SPA. There is no separate frontend server, no CDN-split deployment, and no microservices. This is a deliberate choice: the platform is operated by one person, and operational simplicity is a feature.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Manus CloudRun Instance                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Express 4 Server (:3000)               │  │
│  │                                                          │  │
│  │  /api/trpc/*  ──────────► tRPC Router                   │  │
│  │  /api/oauth/* ──────────► Manus OAuth Handler           │  │
│  │  /manus-storage/* ──────► S3 Presigned Redirect         │  │
│  │  /* (SPA)     ──────────► Vite-built React bundle       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  MySQL/TiDB │  │  S3 Storage  │  │  Manus Forge LLM   │    │
│  │  (Drizzle)  │  │  (AWS SDK v3)│  │  (invokeLLM)       │    │
│  └─────────────┘  └──────────────┘  └────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Nodemailer (lazy, SMTP via env, fail-safe)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ HTTPS                        │ Manus OAuth
    Browser                        Manus Auth Server
```

---

## 2. Request routing

The Manus runtime proxy routes all traffic to the single Express process. Express handles routing internally:

| Path prefix | Handler | Notes |
|---|---|---|
| `/api/trpc/*` | tRPC adapter | All application procedures |
| `/api/oauth/callback` | Manus OAuth callback | Sets session cookie |
| `/api/oauth/logout` | Session clear | Clears cookie |
| `/manus-storage/*` | S3 presigned redirect | Serves uploaded files |
| `/*` (catch-all) | Vite SPA bundle | React router handles client-side nav |

There are no other server routes. All application logic is in tRPC procedures. This is enforced by convention: the template's `server/_core/index.ts` mounts the tRPC adapter and OAuth handlers; application-specific routes must not be added outside `server/routers.ts`.

---

## 3. Frontend architecture

The React frontend is a single-page application built with Vite. Routing is handled client-side by Wouter (a lightweight React Router alternative). The tRPC React Query client provides all data fetching and mutation with automatic cache management.

### 3.1 Page structure

```
App.tsx (ThemeProvider → TooltipProvider → Toaster → Router)
  │
  ├── SiteShell.tsx (nav + footer, wraps all public pages)
  │     ├── Home.tsx
  │     ├── ChurchRecord.tsx
  │     ├── Timeline.tsx
  │     ├── Evidence.tsx
  │     ├── Submit.tsx (auth-gated: sign-in CTA if not authenticated)
  │     ├── PublicRecords.tsx
  │     ├── Actors.tsx
  │     ├── Election.tsx
  │     ├── Patterns.tsx
  │     └── Privacy.tsx
  │
  ├── Admin.tsx (auth-gated: admin role required)
  │     ├── StoriesTab (moderation queue)
  │     ├── DocumentsTab (moderation queue + visibility counters)
  │     ├── IngestTab (Goblin draft review)
  │     ├── PrrTab (public records requests)
  │     ├── AuditTab (log viewer + CSV export)
  │     └── UsersTab (user management + role control)
  │
  └── DocketGoblinBubble.tsx (floating, admin-only, all pages)
```

### 3.2 Design system

The design system is defined in `client/src/index.css` using Tailwind CSS 4 CSS variable tokens. The theme is dark by default (deep navy `#0d1117` background, bone `#f5f0e8` text, amber `#d4a017` accent, muted red `#8b2635` signal). Typography uses three typefaces loaded via Google Fonts CDN:

- **Fraunces** (serif, variable weight) — headings and display text
- **Inter** (sans-serif, variable) — body text and UI
- **JetBrains Mono** (monospace) — case numbers, docket references, code

---

## 4. tRPC layer

tRPC provides end-to-end type safety without code generation. The procedure definitions in `server/routers.ts` are imported directly by the frontend via `client/src/lib/trpc.ts`. TypeScript infers input and output types across the network boundary.

### 4.1 Procedure tiers

Three procedure tiers are defined in `server/_core/trpc.ts`:

| Tier | Middleware | Use |
|---|---|---|
| `publicProcedure` | None | Any caller, authenticated or not |
| `protectedProcedure` | Requires `ctx.user !== null` | Authenticated users only |
| `adminProcedure` | Requires `ctx.user.role === "admin"` | Admin users only |

### 4.2 Context

Every request builds a `TrpcContext` in `server/_core/context.ts`:

```typescript
type TrpcContext = {
  user: User | null;   // null if not authenticated or session invalid
  req: Request;        // Express request (for IP, headers)
  res: Response;       // Express response (for cookie operations)
};
```

The context is built by verifying the session cookie JWT. If the cookie is missing, expired, or invalid, `ctx.user` is `null`. No procedure throws on missing auth in context construction — the procedure tier middleware handles the rejection.

### 4.3 Router hierarchy

```
appRouter
  ├── auth.me          (public)
  ├── auth.logout      (public)
  ├── system.notifyOwner (protected)
  ├── story.*          (mix: public reads, protected submit, admin moderation)
  ├── document.*       (mix: public reads, admin upload/update)
  ├── timeline.*       (mix: public reads, admin CRUD)
  ├── actor.*          (mix: public reads, admin CRUD)
  ├── prr.*            (mix: public reads, admin CRUD)
  ├── patterns.metrics (public)
  ├── docketGoblin.*   (admin only: chat, ingest, approveIngest, ingestList, history, resetChat)
  ├── user.*           (admin only: adminList, adminListWithCounts, setRole)
  └── audit.*          (admin only: list, exportCsv)
```

---

## 5. Authentication flow

```
1. User clicks "Sign In"
   └── Frontend calls getLoginUrl(returnPath)
       └── Encodes window.location.origin + returnPath in state param
       └── Redirects to VITE_OAUTH_PORTAL_URL

2. Manus OAuth completes
   └── Redirects to /api/oauth/callback?code=...&state=...

3. Server callback handler (server/_core/oauth.ts)
   └── Exchanges code for token with OAUTH_SERVER_URL
   └── Parses state to extract origin + returnPath
   └── Calls upsertUser() — creates or updates user record
       └── If user.openId === OWNER_OPEN_ID → role = "admin"
   └── Signs JWT session cookie (JWT_SECRET, HttpOnly, Secure, SameSite=None)
   └── Redirects to origin + returnPath

4. Subsequent requests
   └── Cookie sent automatically by browser
   └── server/_core/context.ts verifies JWT
   └── ctx.user populated with full User record
   └── adminProcedure checks ctx.user.role === "admin"
```

---

## 6. Storage flow

```
File upload (admin or authenticated user)
  │
  ├── Client: file → base64 encoded → tRPC mutation input
  │
  ├── Server: _uploadGuard.validateUpload()
  │     ├── Decode base64 → Buffer
  │     ├── Check MIME allow-list
  │     ├── Check magic bytes (first 16 bytes vs declared MIME)
  │     ├── Check size ≤ 15 MB
  │     ├── Check filename (no path traversal)
  │     └── Check rate limit (DB query)
  │
  ├── Server: storagePut(fileKey, buffer, mimeType)
  │     └── AWS SDK PutObjectCommand → S3
  │     └── Returns { key, url: "/manus-storage/{key}" }
  │
  └── Server: DB insert with fileKey + fileUrl
        └── publicStatus: false, reviewStatus: "pending" (hard defaults)

File retrieval
  └── Client requests /manus-storage/{key}
  └── Manus runtime generates presigned S3 GET URL
  └── 302 redirect to presigned URL
  └── Browser fetches directly from S3
```

---

## 7. Docket Goblin pipeline

```
Admin drops file onto Goblin chat bubble
  │
  ├── Client: file → base64 → trpc.docketGoblin.ingest.mutate()
  │
  ├── Server: validateUpload() [same guard as above]
  │
  ├── Server: storagePut() → S3
  │
  ├── Server: pdf-parse (if PDF) → extractedText
  │
  ├── Server: invokeLLM({
  │     messages: [system prompt + extractedText + archive context],
  │     response_format: { type: "json_schema", schema: ingest_draft_schema }
  │   })
  │   └── Returns: { title, summary, sourceType, caseNumber, documentDate,
  │                  actorNames, tags, proposedTimeline, warnings }
  │
  ├── Server: DB insert → documents (publicStatus: false, reviewStatus: "pending",
  │                                   visibility: "pending_review", aiPolicy: "no_ai_processing")
  │
  ├── Server: DB insert → ingest_jobs (status: "drafted", draftJson: LLM output)
  │
  ├── Server: writeAudit(document_ingested)
  │
  └── Client: Goblin bubble shows draft card with "Open in Admin" link

Admin reviews draft in Admin → Ingest tab
  │
  └── Clicks "Approve"
        └── trpc.docketGoblin.approveIngest.mutate({
              jobId, approveDocument, publishDocument,
              createTimelineEvent, publishTimelineEvent
            })
              ├── Updates document.reviewStatus = "approved"
              ├── Sets document.publicStatus = input.publishDocument
              ├── Optionally creates timeline_events record
              └── writeAudit(document_approved)
```

The Goblin has no path to set `publicStatus: true` without the admin explicitly passing `publishDocument: true` in the approve call. Even then, the admin must click the button.

---

## 8. Email flow

```
Trigger event (story submit / file upload / admin decision)
  │
  └── emailXxx({ to, ...safeMetadata })
        │
        ├── isEmailConfigured() → false?
        │     └── return { sent: false, reason: "smtp_not_configured" }
        │         log: "[email] SMTP env missing — email skipped at runtime"
        │
        └── isEmailConfigured() → true?
              └── getTransport() → lazy nodemailer createTransport()
              └── transport.sendMail({ from, to, subject, text, html })
              └── return { sent: true }
                  (or { sent: false, reason: error.message } on failure)

Email outcome is written to audit_log metadata:
  metadata.email = "email_sent" | "email_skipped:{reason}"
```

---

## 9. Audit log flow

```
Any security-relevant action
  │
  └── writeAudit({
        actorUserId, actorRole,
        action,           // one of 13 enum values
        targetType,       // "story" | "document" | "user" | "ingest_job" | etc.
        targetId,
        metadata,         // JSON: old/new values, email outcome, etc.
        ipHash            // SHA-256(req.ip), not reversible
      })
        └── DB insert → audit_log (append-only, no delete procedure)

Admin views audit log
  └── trpc.audit.list({ actorUserId?, action?, targetType?,
                        dateFrom?, dateTo?, q?, limit?, offset? })
        └── Filtered DB query with pagination
        └── Returns rows with full metadata

Admin exports audit log
  └── trpc.audit.exportCsv({ same filters })
        └── Returns CSV string: id,createdAt,actorUserId,actorRole,
                                action,targetType,targetId,metadata,ipHash
```

---

## 10. Database schema overview

Fourteen tables across four migrations. See [DATA_DICTIONARY.md](./DATA_DICTIONARY.md) for full column-level documentation.

```
users               ← Manus OAuth accounts, roles
stories             ← Submitted narratives, moderation state
documents           ← Uploaded evidence files, visibility, AI policy
timeline_events     ← Chronological case events, source doc links
actors              ← Judges, attorneys, officials, institutions
public_records_requests ← PRR tracking (status, agency, dates)
agent_tasks         ← Legacy AI task queue (pre-Goblin)
chat_sessions       ← Goblin chat session headers
chat_messages       ← Goblin chat message history
ingest_jobs         ← Goblin ingest pipeline state
audit_log           ← Immutable security event log
```

---

## 11. Key design decisions and rationale

**Single process, single port.** Eliminates CORS, simplifies deployment, reduces operational surface. The tradeoff is that a CPU-intensive LLM call blocks the event loop. Mitigated by: LLM calls are admin-only (low concurrency), Node.js is non-blocking for I/O, and the platform is not expected to handle high concurrent load in v1.

**tRPC over REST.** End-to-end type safety without a code generation step. The TypeScript types are the contract. This eliminates an entire class of frontend/backend drift bugs. The tradeoff is that tRPC is less familiar to external contributors and cannot be called from non-TypeScript clients without the generated types.

**Drizzle over Prisma.** Drizzle is lighter, faster at startup, and produces SQL that is easier to audit. The schema-as-code model means migrations are explicit SQL files that can be reviewed before application. The tradeoff is less ecosystem tooling.

**Append-only audit log.** The audit log has no delete or update procedure. This is intentional: the log must be trustworthy. If an admin could delete audit entries, the log would not be a reliable accountability record. The tradeoff is that the log grows indefinitely — a future archival/rotation strategy will be needed at scale.

**Magic-byte MIME validation.** Checking only the declared MIME type or file extension is insufficient. A malicious actor can rename `evil.exe` to `evidence.pdf`. The upload guard reads the first 16 bytes of every file and compares them against known magic byte signatures for each allowed MIME type. Files that fail this check are rejected regardless of their declared type.

**Fail-safe email.** Email is a notification channel, not a security boundary. If SMTP is misconfigured, the platform must continue to function. The fail-safe design ensures that a missing `SMTP_HOST` env var does not cause submission failures or server errors.
