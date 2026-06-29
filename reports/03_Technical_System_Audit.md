# The Reno Record — Technical & System Audit

**Subject:** A complete front-end and back-end audit of the live system, written so a third-party assessor can independently judge value, worth, and risk.
**Prepared for:** Cameron Church
**Author:** Manus AI
**Version:** 1.0 — Grounded in the live v7.2 codebase (checkpoint `7c2d3b4c`)
**Method:** Direct inspection of source, schema, routers, pipeline modules, test suite, and live database row counts. Figures below are measured from the codebase, not estimated.

---

## 1. Executive summary for the assessor

The Reno Record is a single-process, full-stack TypeScript web application implementing a document-to-structured-intelligence pipeline over a relational database, fronted by a 28-page React application and a typed RPC API, and now additionally exposed through a scoped-key public REST API with OpenAPI and MCP manifests. The codebase is approximately **35,500 lines of TypeScript/TSX**, organized into a 22,500-line client and an 11,800-line server, backed by a **32-table schema** and **127 RPC procedures**, with **108 passing automated tests and zero TypeScript errors** at the audited checkpoint.

The system is **functionally complete and demonstrably working on real data** — one live case fully processed — but is **architecturally single-tenant**. The most important thing for a valuation is to hold both facts at once: the hard, high-risk engineering (the AI pipeline, the trust/verifiability layer, the provenance architecture, the auth model, the test discipline) is built and tested; the remaining work to make it a multi-customer commercial platform (tenancy isolation, scale validation, operational hardening) is real but is additive rather than corrective. This is a maturing asset, not a prototype and not yet a turnkey platform.

| Metric | Measured value |
|---|---|
| Total TS/TSX lines | ~35,485 |
| Client lines | ~22,466 |
| Server lines | ~11,807 |
| Database tables | 32 |
| tRPC procedures | 127 |
| React pages | 28 |
| Automated tests (passing) | 108 / 108 |
| TypeScript errors | 0 |
| Largest server files | `routers.ts` (~2,943), `db.ts` (~1,885), `schema.ts` (~1,180) |
| Live data (one case) | 50 documents, 17 actors, 80 timeline events, 15 violation tag types (137 applications), 14 PRRs, 50 immutable versions, 80 audit entries |

---

## 2. Technology stack

The stack is modern, mainstream, and internally consistent — which lowers maintenance risk and key-person dependency for an acquirer.

| Layer | Technology | Version (from `package.json`) | Assessment |
|---|---|---|---|
| Frontend framework | React | 19.x | Current major; long support runway |
| Routing | wouter | 3.x | Lightweight; low lock-in |
| Data fetching | TanStack Query + tRPC React | 5.x / 11.x | Type-safe end-to-end |
| UI primitives | Radix UI + Tailwind + shadcn pattern | current | Accessible, standard, replaceable |
| Animation / charts | framer-motion / recharts | 12.x / 2.x | Standard |
| Forms / validation | react-hook-form + zod | 7.x / 4.x | Validation shared client/server |
| Server | Express | 4.x | Mature, well-understood |
| RPC | tRPC server | 11.x | Type-safe contract, no manual REST surface for internal calls |
| ORM | Drizzle | 0.44.x | Schema-first, migration-tracked |
| Database | MySQL/TiDB-compatible | — | Relational, transactional |
| Serialization | superjson | 1.x | Preserves Date/types across the wire |
| Payments | Stripe | 22.x | Billing rails present |

The single most important architectural fact: **types flow end to end.** The database schema generates Drizzle types, those types surface through tRPC procedures, and the React client consumes them with full type-checking. A whole class of integration bugs is eliminated structurally. For an assessor, this materially reduces the estimated cost of safe future modification.

---

## 3. Data model (32 tables)

The schema is the strongest single indicator of how seriously this was built. It is not a flat "documents + users" design; it is a normalized forensic data model with explicit provenance, classification, and relationship tables.

The tables group into seven functional clusters:

**Core archive:** `stories` (cases/matters), `documents` (the central entity, with classification, dates, record-status, and review fields), `timeline_events`, `actors`, `agencies`, `public_records_requests`.

**Classification and relationships:** `violation_tags` (the taxonomy), `document_violation_tags` (many-to-many tagging with source attribution), `actor_agency_roles`, `actor_document_links`, `actor_timeline_links`, `filing_packages` (grouping filings by docket entry), `judicial_cases`, `boilerplate_phrases`.

**Pipeline and processing:** `ingest_jobs` (per-ingest lifecycle: pending → extracted → drafted → approved/failed), `chat_sessions`, `chat_messages`, `agent_tasks`.

**Provenance and trust:** `document_versions` (immutable snapshots) and `audit_log` (append-only action log). These two tables are the trust architecture and are the hardest part to retrofit.

**Identity and access:** `users` (with a `role` enum for admin/user separation) and `api_keys` (scoped, hashed keys for the public API).

**Contribution and gamification:** `contributor_xp`, `badge_definitions`, `contributor_badges`, `credit_ledger`, `leaderboard` support.

**Operator/portfolio layer:** `operator_profile`, `build_log_entries`, `projects`, `audit_requests` — the public-facing "who built this" surface.

The presence of `document_versions` and `audit_log` as first-class tables, designed from the schema up rather than bolted on, is the detail an experienced assessor will weight most heavily. It signals the system was architected for defensibility, not just function.

---

## 4. The AI pipeline — the core asset

This is what is actually being valued. The pipeline is implemented as a **single shared code path** (`server/_pipeline.ts`, `runGoblinPipeline`) used by *both* the admin upload procedure and the public API ingest endpoint. That unification is significant: it means there is exactly one place where safety guarantees live, so the read- and ingest-surfaces cannot drift apart in their behavior.

The pipeline executes the following stages on every document, regardless of trigger surface:

1. **Job creation** — an `ingest_jobs` row tracks the lifecycle and captures failures.
2. **Storage** — the raw file is written to object storage (S3) under a namespaced key; the database stores only the key/URL reference, never the bytes.
3. **Text extraction** — content is extracted and capped, with extraction quality recorded.
4. **Structured drafting** — an LLM call produces a structured draft (title, summary, source type, case number, actor names, tags) using an archive-context string so naming stays consistent across documents.
5. **Pending document creation** — the document is created with `publicStatus=false`, `reviewStatus="pending"` as a hard, non-overridable guarantee.
6. **Classification + QC** — a separate stage classifies record status (state on-record / federal on-record / supporting / not-yet-filed / unclassified) with confidence and a reason, extracts the real filing-stamp date with a `dateSource`, `dateConfidence`, and a `needsDateReview` flag (the system flags undated documents rather than fabricating a date), and runs a deterministic QC supervisor that downgrades weak claims and escalates only genuine ambiguity. Escalations trigger an owner notification.
7. **Immutable snapshot** — a v1 snapshot is written to `document_versions`.
8. **Verifiability scoring + gated auto-publish** — the draft is scored 0–100 on an explicit rubric; the document is published *only if* the verdict is `auto_publish` **and** the score clears the threshold (75 for admin-sourced, 80 for public submissions). Everything else stays pending for human review.

The verifiability rubric is explicit and inspectable (`server/goblinAutoPublish.ts`): positive points for official headers/signatures, readable dates, case numbers, recognized document types, and high-confidence actors/evidence; penalties for poor extraction and for PII/redaction risks (SSN, DOB, medical, sealed records). High-severity redaction risk forces human review regardless of score. This is the single most valuable piece of intellectual property in the system, because it is the mechanism that makes the output *trustworthy enough to act on*, and it encodes domain judgment rather than generic model output.

> **Assessor's note:** The hard safety guarantees are enforced in code at the pipeline level (`publicStatus=false`, `reviewStatus="pending"` set unconditionally before any publish decision), and there is a dedicated automated test asserting that ingest never auto-publishes outside the threshold path. This is the correct place to enforce it and the correct way to prove it.

---

## 5. API surfaces

There are two distinct API surfaces, correctly separated.

**Internal RPC (tRPC).** 127 procedures across ~24 routers (`system`, `auth`, `story`, `document`, `timeline`, `actor`, `prr`, `patterns`, `docketGoblin`, `user`, `audit`, `reviewRequest`, `userData`, `adminEdit`, `agency`, `violationTag`, `actorLink`, `billing`, `judicialPattern`, `auditRequest`, `leaderboard`, `operator`, `evidenceEngine`, `apiKey`). Procedures are gated as public, protected, or admin. This is the application's own front-end contract and is fully type-checked end to end.

**Public REST API (v7.2).** A separate Express router under `/api/public`, authenticated by scoped API keys (`read` vs `ingest`), with read endpoints (`/stats`, `/documents`, `/documents/:id`, `/violations`, `/actors`, `/timeline`), an ingest endpoint, and two unauthenticated discovery manifests (`/openapi.json`, `/mcp.json`). Read endpoints enforce `publicStatus=true AND reviewStatus=approved` in the data layer, so no query parameter can expose drafts. Internal fields (`fileKey`, `uploadedBy`) are redacted from both documents and version snapshots before serialization. This surface is what makes the engine embeddable and agent-consumable.

---

## 6. Security posture

| Control | Status | Notes |
|---|---|---|
| Authentication | Manus OAuth | Session cookie, parsed per request into `ctx.user` |
| Authorization | Role-based (admin/user) | Enforced server-side in protected/admin procedures |
| Public API auth | Scoped API keys | SHA-256 hashed at rest, full key shown once, prefix stored for display, revocable |
| Scope enforcement | read vs ingest | Read key on ingest → 403, covered by test |
| PII handling | Redaction-risk scoring | High-severity PII forces human review; bytes never in DB |
| Internal field leakage | Redacted | `fileKey`/`uploadedBy` stripped from API responses incl. version snapshots |
| Provenance | Immutable versions + append-only audit | Tamper-evident by design |
| File storage | S3 reference only | Signed `/manus-storage/` path; raw key never exposed |
| Rate limiting | Per-key-creator on ingest | 30 ingests / 24h |
| Secrets | Platform-injected env | No secrets committed; standard env model |

The security model is appropriate for the application class. The notable strengths are the hashed scoped keys, the data-layer enforcement of public-visibility (rather than relying on the UI), and the redaction of internal fields including inside version snapshots — a leak that is easy to miss and was explicitly closed. The notable limitation, addressed in §8, is that authorization is role-based within a single tenant; there is no per-organization data isolation yet.

---

## 7. Front-end audit

The client is 28 pages and a component library built on Radix primitives in the shadcn pattern, with a shared `SiteShell`, a `DashboardLayout` for admin surfaces, an `ErrorBoundary`, and reusable feature components (the Docket Goblin chat bubble, a maps integration, dialogs). The public surface includes the home dashboard with live gauges, the church/case record, timeline, evidence archive with four-way record-status grouping and filing-date sorting, evidence detail with document viewer and violation signals, actors and agencies, patterns and judicial-pattern analysis, cases, public records, an operator/portfolio section, and billing/pricing pages. Admin surfaces cover operational control, inline editorial editing, the audit log, and the new API-keys management tab with one-time key reveal, copy, revoke confirmation, and an explicit error/retry state on load failure.

Data access is uniformly through tRPC hooks with typed responses and handled loading/empty/error states; there is no ad-hoc fetch layer. The theme is locked dark site-wide with no light-flash. For an assessor, the front-end is **broad and complete relative to the feature set**, consistent in its design system, and low-risk to maintain because it uses standard, replaceable libraries and a single data-access pattern. The breadth (28 pages) also means there is real surface area to QA before a commercial launch — completeness here is a cost as well as an asset.

---

## 8. Risk register

The risks are organized by severity for valuation purposes. None are fatal; the first is the one that most gates commercial scale.

**High — Single-tenancy.** The system is architected for one owner and one archive. There is no per-organization data partition, no tenant scoping on queries, and billing/identity assume a single operator context. Converting to multi-tenant SaaS requires tenant keys across the schema, query-level isolation, per-tenant billing, and an access model above the current admin/user roles. This is the principal engineering gap between the current asset and a scalable commercial platform, and it should be priced into any valuation as defined, additive work rather than as a defect.

**High — Concentration on one case / one founder.** The only live, end-to-end-processed data is the founder's own matter. This is excellent for authenticity and go-to-market but means the engine's generality is demonstrated, not yet proven at variety. A second independent case processed through the public API would convert this from a claim to evidence.

**Medium — Model dependency and unit economics.** The pipeline depends on an external LLM. Quality, latency, and per-document cost ride on that provider. The QC and verifiability layers mitigate quality risk, but cost-per-document at volume is not yet documented and must be measured before usage-based pricing is underwritten.

**Medium — Legal exposure (UPL and publication liability).** Serving document intelligence to pro se litigants sits near unauthorized-practice-of-law lines, and auto-publishing a misclassified or under-redacted document carries reputational and legal risk. The product's posture is correct — it structures and surfaces rather than advising or auto-filing, and it gates publication on verifiability and PII risk — but this posture must be maintained deliberately and ideally backed by a formal legal review memo before scaling.

**Low — Operational maturity.** As a single-process app on serverless autoscale hosting, there are standard production gaps to close for a commercial SLA: monitoring/alerting depth, backup/restore drills, load testing at concurrency, and a defined incident process. These are routine hardening items, not architectural problems.

**Low — Large-file modules.** `routers.ts` (~2,900 lines) and `db.ts` (~1,900 lines) are large enough to warrant splitting for long-term maintainability. This is hygiene, not a defect, and the codebase's own conventions already call for it.

---

## 9. What the test suite proves (and does not)

The suite is **108 tests, all passing, zero TypeScript errors**, spanning the document/ingest pipeline (including the explicit assertion that ingest creates only a pending, non-public document and never auto-publishes outside the threshold path), the public API (auth, invalid/revoked keys, scope enforcement, field redaction on documents and version snapshots, read endpoints, and manifest generation), the operator layer, storage proxy, and auth/logout. The tests run against the live database through real callers rather than heavy mocking, which makes them high-signal: they exercise the actual code paths.

What the suite proves is **behavioral correctness of the core guarantees** — the safety properties that matter most for trust are tested, not asserted. What it does not yet cover is multi-tenant isolation (which does not exist to test), concurrency/load behavior, and end-to-end browser flows across all 28 pages. For an assessor, the coverage is **focused on the right things** — the trust and safety properties — which is exactly where test investment should concentrate first.

---

## 10. Valuation framing for the assessor

To value this correctly, separate three layers:

**The engine** — the pipeline, the violation taxonomy, the verifiability/QC trust layer, and the provenance architecture. This is the durable, defensible IP. It is built, tested, and demonstrably working on real material. This is where most of the value sits.

**The interface** — the typed internal API and the agent-native public REST/OpenAPI/MCP surface. This is what makes the engine embeddable and is increasingly valuable as legal workflows move toward agent orchestration. Built and shipped.

**The application** — the 28-page archive and admin platform. This is the proof and the direct-to-user product. Complete and consistent, but single-tenant.

The fair characterization is a **functionally complete, well-architected, tested single-tenant system with defensible AI and provenance IP, requiring a defined and additive (not corrective) multi-tenancy and hardening effort to become a scalable commercial platform.** The high-risk engineering is done; the remaining work is known, bounded, and builds on a stable, tested base. An assessor should weight the trust/provenance architecture and the agent-native interface heavily, discount appropriately for single-tenancy and single-case concentration, and treat the 108-test, zero-error state as credible evidence of build quality rather than marketing.

---

## Appendix A — Measured codebase facts

All figures captured by direct inspection at checkpoint `7c2d3b4c`:

- Lines of TypeScript/TSX: ~35,485 (client ~22,466 / server ~11,807)
- Schema: 32 tables, ~1,180 lines
- RPC: 127 procedures, `routers.ts` ~2,943 lines
- Query layer: `db.ts` ~1,885 lines
- Pipeline modules: `_pipeline.ts` (267), `_goblin.ts` (715), `goblinAutoPublish.ts` (150), `_uploadGuard.ts` (347)
- Tests: 108 passing across 6 test files; 0 TypeScript errors
- Live data (single case): 50 documents (all 50 public/approved), 17 actors, 80 timeline events, 15 violation tag types with 137 applications, 14 public-records requests, 50 immutable document versions, 80 audit-log entries, 10 agencies, 5 portfolio projects, 17 ingest jobs

## Appendix B — Verifiability scoring rubric (as implemented)

| Signal | Score impact |
|---|---|
| Official headers / signatures | +30 |
| Readable dates | +20 |
| Case number present | +15 |
| Recognized document type (not "other") | +15 |
| Good text-extraction quality | +10 (partial +5) |
| ≥1 high-confidence actor | +5 |
| ≥1 high-confidence evidence item | +5 |
| Poor/no text extraction | −20 |
| Unknown type, no case number, no dates | −15 |
| Per high-severity redaction risk | −10 (forces human review) |
| Per medium-severity redaction risk | −5 |
| **Auto-publish threshold (admin)** | **≥ 75** |
| **Auto-publish threshold (public)** | **≥ 80** |
| **Reject threshold** | **< 30** |
