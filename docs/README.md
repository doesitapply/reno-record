# The Reno Record

**Receipts for Due Process** — a public-interest investigative archive documenting court delay, ignored filings, pretrial detention harm, self-representation barriers, missing records, and procedural abuse patterns in Washoe County, Nevada.

---

## What this is

The Reno Record is a full-stack web application that functions as a structured, evidence-backed accountability archive. It is not a blog. Every claim is anchored to a source document. Every document passes through an explicit admin moderation workflow before any public exposure. The AI assistant (Docket Goblin) is advisory only and has no auto-publish capability under any circumstance.

The platform has two layers:

- **Public accountability layer** — free, drives reach and credibility. Includes the narrative record, timeline, pattern dashboard, public records tracker, actor profiles, and neutral election accountability page.
- **Receipts tier (planned, v4)** — paid subscription. Unlocks the full unredacted evidence archive, inline PDF viewer, full actor dossiers, and Docket Goblin AI chat.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (ESM) |
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui |
| API layer | tRPC 11 (end-to-end typed, no REST) |
| Backend | Express 4 |
| Database | MySQL / TiDB via Drizzle ORM 0.44 |
| Auth | Manus OAuth (session cookie, JWT-signed) |
| Storage | S3-compatible object storage via AWS SDK v3 |
| AI | Manus Forge LLM API (invokeLLM helper) |
| PDF extraction | pdf-parse |
| Email | Nodemailer (lazy transport, fail-safe) |
| Testing | Vitest 2 |
| Hosting | Manus managed hosting (CloudRun-backed) |

---

## Quick start (local development)

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 10
- A MySQL/TiDB database (connection string in `DATABASE_URL`)
- Manus platform credentials (injected automatically in the Manus sandbox)

### Install

```bash
git clone <repo-url>
cd reno-record
pnpm install
```

### Environment variables

Copy the template and fill in values. In the Manus sandbox all system variables are injected automatically. For local development outside Manus, you need to provide them manually.

```bash
cp .env.example .env
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full variable reference.

### Database setup

```bash
# Generate migration SQL from schema
pnpm drizzle-kit generate

# Apply migrations (reads DATABASE_URL from env)
pnpm drizzle-kit migrate

# Seed initial content (Church Record case, actors, timeline, PRRs)
node scripts/seed.mjs
```

### Run

```bash
pnpm dev
```

The dev server starts on `http://localhost:3000`. Both the Express API and the Vite frontend are served from the same port via the Manus runtime proxy.

### Test

```bash
pnpm test
```

All 41 tests must pass before any commit. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the test requirements and PR checklist.

---

## Project structure

```
reno-record/
├── client/
│   ├── index.html              # Google Fonts CDN, meta tags
│   └── src/
│       ├── _core/              # Auth hooks, tRPC client binding (framework — do not edit)
│       ├── components/
│       │   ├── SiteShell.tsx   # Global nav + footer (all public pages)
│       │   ├── DocketGoblinBubble.tsx  # Floating AI chat bubble (admin only)
│       │   └── ui/             # shadcn/ui primitives
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── ChurchRecord.tsx
│       │   ├── Timeline.tsx
│       │   ├── Evidence.tsx
│       │   ├── Submit.tsx
│       │   ├── PublicRecords.tsx
│       │   ├── Actors.tsx
│       │   ├── Election.tsx
│       │   ├── Patterns.tsx
│       │   ├── Admin.tsx
│       │   └── Privacy.tsx
│       ├── App.tsx             # Route wiring
│       └── index.css           # Design system tokens
├── drizzle/
│   ├── schema.ts               # Single source of truth for all tables
│   └── 0000–0003_*.sql         # Applied migrations
├── scripts/
│   ├── seed.mjs                # Initial content seed
│   └── migrate000*.mjs         # Migration runner scripts
├── server/
│   ├── _core/                  # OAuth, tRPC context, LLM, storage, env (framework — do not edit)
│   ├── _uploadGuard.ts         # MIME validation, magic-byte sniff, rate limits, audit write
│   ├── _email.ts               # Nodemailer transport, redaction-safe templates
│   ├── _goblin.ts              # Docket Goblin ingest schema + LLM prompt
│   ├── db.ts                   # All Drizzle query helpers
│   ├── routers.ts              # All tRPC procedures
│   ├── storage.ts              # S3 helpers (storagePut / storageGet)
│   ├── auth.logout.test.ts     # Auth test (reference)
│   └── renoRecord.test.ts      # Full feature test suite (41 tests)
├── docs/
│   ├── README.md               # This file
│   ├── WHITEPAPER.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── DATA_DICTIONARY.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── CONTRIBUTING.md
│   └── V4_MONETIZATION.md
└── todo.md                     # Feature tracking
```

---

## Core design principles

**No auto-publishing.** Every submitted story and every uploaded document defaults to `reviewStatus: "pending"` and `publicStatus: false`. Nothing becomes publicly visible without an explicit admin approval action. This is enforced at the server procedure level, not just the UI.

**Advisory AI only.** Docket Goblin can draft tags, summaries, and proposed timeline events. It writes only to the `aiSummary`, `aiTags`, and `ingest_jobs.draftJson` fields. It has no write access to `publicStatus`, `reviewStatus`, or `documentVisibility`. This is enforced in code, not policy.

**Audit everything.** Every security-relevant action — submission, upload, approval, rejection, visibility change, AI policy change, role change, rate-limit trigger, upload rejection — is written to the `audit_log` table with actor, role, target, timestamp, IP hash, and metadata. The audit log is append-only and admin-viewable with full filtering and CSV export.

**Fail safe.** SMTP is configured via env. If the env is missing, email functions return `{ sent: false, reason: "smtp_not_configured" }` and log `[email] SMTP env missing — email skipped at runtime`. They never throw. The application continues normally.

---

## Admin access

The Manus platform automatically promotes the project owner's account to `admin` role on first sign-in. All admin procedures are gated behind `adminProcedure`, which checks `ctx.user.role === "admin"`. The admin panel is accessible at `/admin`.

Admin lockout protection is enforced: an admin cannot remove their own admin role. This is checked in `user.setRole` before the update is applied.

---

## Roadmap

| Version | Status | Summary |
|---|---|---|
| v1 | Shipped | Full public site, all pages, seeded Church Record case |
| v2 | Shipped | Docket Goblin chat bubble + auto-ingest pipeline |
| v3 | Shipped | Auth-gated submissions, upload guard, 7-state visibility, AI policy, audit log |
| v3.5 | Shipped | Audit log viewer, user management, SMTP, email outcome metadata, 41 tests |
| v4 | Spec written | Receipts paywall, Goblin Pro, Founding lifetimes, credit packs, Stripe |
| v5 | Planned | Team/multi-seat plans, API keys, affiliate/referral, comments |

See [V4_MONETIZATION.md](./V4_MONETIZATION.md) for the full v4 spec.

---

## License

Proprietary. All rights reserved. Source code is not open for redistribution without explicit written permission from the project owner.
