# The Reno Record — Architecture Reference

**Version:** 2.0 (platform release v4.0)

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
  │     ├── Actors.tsx          ← v4.0: agency roles, violation tags, linked docs
  │     ├── Agencies.tsx        ← v4.0: agency hub index
  │     ├── AgencyDetail.tsx    ← v4.0: per-agency actor roster + document list
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
  │     ├── UsersTab (user management + role control)
  │     ├── AgenciesTab         ← v4.0: agency CRUD
  │     └── ViolationTagsTab    ← v4.0: taxonomy management
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
  ├── auth.me                    (public)
  ├── auth.logout                (public)
  ├── system.notifyOwner         (protected)
  ├── story.*                    (mix: public reads, protected submit, admin moderation)
  ├── document.*                 (mix: public reads, admin upload/update)
  ├── timeline.*                 (mix: public reads, admin CRUD)
  ├── actor.*                    (mix: public reads, admin CRUD)
  ├── prr.*                      (mix: public reads, admin CRUD)
  ├── patterns.metrics           (public)
  ├── docketGoblin.*             (admin only: chat, ingest, approveIngest, ingestList, history, resetChat)
  ├── user.*                     (admin only: adminList, adminListWithCounts, setRole)
  ├── audit.*                    (admin only: list, exportCsv)
  ├── reviewRequest.*            (protected submit; admin resolve)
  ├── adminEdit.*                (admin only: softDelete, hardDelete, restore, inlineEdit)
  ├── agency.*                   (v4.0 — public list/getBySlug; admin create/update)
  ├── violationTag.*             (v4.0 — public list/getBySlug; admin create)
  └── actorLink.*                (v4.0 — admin: actorDocumentLink, actorAgencyRole, documentViolationTag CRUD)
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
  │                  actors[{name, role, confidence}], patternSignals[{slug, description}],
  │                  proposedTimeline, warnings }
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
              ├── Writes actor_document_links from draft.actors
              │     └── Matches actor names to actors table (fuzzy)
              │     └── Inserts with confidence from LLM, addedBy: "goblin"
              ├── Writes document_violation_tags from draft.patternSignals
              │     └── Matches signal.slug to violation_tags table
              │     └── sourceQuote = signal.description (AI-generated, marked for review)
              │     └── confidence < 100, addedBy: "goblin"
              └── writeAudit(document_approved)
```

The Goblin has no path to set `publicStatus: true` without the admin explicitly passing `publishDocument: true` in the approve call. Goblin-generated actor links and violation tags are marked `addedBy: "goblin"` and `confidence < 100` for human review. Source quotes from the Goblin are AI-generated descriptions, not verified document excerpts — human curation via the Admin panel is required for evidentiary use.

---

## 8. Relational graph (v4.0)

The v4.0 relational layer replaces legacy freetext fields with structured join tables. The graph connects actors, agencies, documents, timeline events, and violation tags.

```
actors ──────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├── actor_agency_roles ──► agencies                                │
  │     (title, startDate, endDate, isCurrent)                       │
  │                                                                   │
  ├── actor_document_links ──► documents                             │
  │     (role, confidence, extractedFrom, addedBy)                   │
  │                                                                   │
  └── actor_timeline_links ──► timeline_events                       │
        (role)                                                        │
                                                                      │
documents ────────────────────────────────────────────────────────────┘
  │
  └── document_violation_tags ──► violation_tags
        (sourceQuote NOT NULL, sourceCitation, confidence, addedBy)
```

**Design invariant:** Every `document_violation_tags` row requires a `source_quote`. This is enforced at the database level (`NOT NULL`) and the application level (procedures reject empty quotes). The graph is the accountability layer; the source quote is the receipt.

---

## 9. Email flow

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

## 10. Audit log flow

```
Any security-relevant action
  │
  └── writeAudit({
        actorUserId, actorRole,
        action,           // one of 24 enum values
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

## 11. Key files

```
drizzle/schema.ts          ← Canonical DB schema (source of truth)
server/db.ts               ← All DB query helpers
server/routers.ts          ← All tRPC procedures
server/_core/              ← Framework plumbing (do not edit)
  ├── context.ts           ← Request context builder
  ├── trpc.ts              ← Procedure tiers
  ├── oauth.ts             ← Manus OAuth handler
  ├── llm.ts               ← invokeLLM helper
  ├── notification.ts      ← notifyOwner helper
  └── index.ts             ← Express server entry point
client/src/
  ├── App.tsx              ← Routes + ThemeProvider
  ├── index.css            ← Design tokens + global styles
  ├── lib/trpc.ts          ← tRPC client binding
  ├── pages/               ← Page-level components
  └── components/          ← Reusable UI components
```

---

## 12. Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Server | MySQL/TiDB connection string |
| `JWT_SECRET` | Server | Session cookie signing |
| `VITE_APP_ID` | Client | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Server | Manus OAuth backend |
| `VITE_OAUTH_PORTAL_URL` | Client | Manus login portal URL |
| `OWNER_OPEN_ID` | Server | Auto-promotes owner to admin |
| `OWNER_NAME` | Server | Owner display name |
| `BUILT_IN_FORGE_API_KEY` | Server | LLM + storage API key |
| `BUILT_IN_FORGE_API_URL` | Server | LLM + storage API base URL |
| `VITE_FRONTEND_FORGE_API_KEY` | Client | Frontend API key (currently server-side only) |
| `VITE_FRONTEND_FORGE_API_URL` | Client | Frontend API URL |
