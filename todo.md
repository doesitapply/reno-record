# The Reno Record — TODO

> Rewritten 2026-06-26. The old multi-plan backlog (90 stale/duplicate/non-autonomous items) was
> archived to `.todo-archive-v7.1.md` and scrapped. This file reflects the ACTUAL state of the
> codebase, not aspirational plans from superseded versions.

---

## SHIPPED (live in code, verified)

### Core archive
- [x] Public site: Home (live gauges), Church Record, Timeline, Evidence Archive, Actors, Agencies, Patterns, Cases, Public Records
- [x] Evidence Archive: 4-way record_status grouping, real filing-stamp date sort, UNDATED flagging, sidebar filters, search, sort
- [x] Evidence Detail: document viewer, metadata, violation signals with source quotes, linked actors/timeline
- [x] Case Intelligence dashboard + Judicial Pattern analysis pages
- [x] Procedural Pattern Signals: live deduplicated counts + hover tooltip (latest tagged doc)

### Docket Goblin engine
- [x] Document ingest pipeline (extract text, AI summary, draft enrichment)
- [x] Filing-stamp date extraction (filing_stamp -> file_metadata -> inferred -> undated, flagged not guessed)
- [x] 5-way record_status auto-classification (state/federal/supporting/unfiled/unclassified) with confidence + reason
- [x] Deterministic QC supervisor pass (corrects coherence, downgrades weak claims, escalates only ambiguous)
- [x] Document version history: immutable snapshots, list/view/restore (restore never destroys)
- [x] Backfill across all existing docs (50 classified, 50 snapshotted, 0 escalated)
- [x] Goblin chat box (talk, drop evidence, auto-structure)

### Operator platform (Artificially Educated)
- [x] /operator (bio, gravity thesis, capabilities build log)
- [x] /projects catalog + /projects/:slug detail (Reno Record pinned flagship)
- [x] Admin CRUD: profile editor, build log, projects
- [x] Nav + footer "The Operator" section, SEO meta

### Infrastructure
- [x] Manus OAuth auth, protected/admin procedures, role-based access
- [x] Admin panel + AdminManage (operational control, editorial inline edit, audit log)
- [x] Stripe integration (checkout, webhook, products, Billing + Pricing pages) — sandbox mode
- [x] Leaderboard page, Profile page, user data rights
- [x] PWA (manifest, icons, sitemap, robots)
- [x] Dark mode locked site-wide, no light flash, toggle removed
- [x] Owner notifications helper
- [x] 92/92 vitest passing, 0 TS errors

---

## OPEN — genuinely unbuilt or content-blocked

### Operator content (blocked on Cam / agent)
- [ ] Real bio/origin text (currently placeholder)
- [ ] Real project descriptions, links, screenshots for: Artificially Educated, Due Process AI, Gaslight Goblin, FAULTLINE
- [ ] Pull GitHub repos + Google AI Studio builds to auto-populate catalog (needs My Browser connected)

### Engine hardening (next build cycle)
- [ ] Surface UNDATED / needs-review queue in admin (so the 26 undated docs are actionable in one view)
- [ ] Admin "reclassify all" button wired to batchClassifyAll procedure (currently script-only)
- [ ] Version history UI on Evidence Detail (view/restore older versions from the page, not just API)
- [ ] Real court PDF test: upload a stamped filing, verify auto-date + classify on live material

### Autonomy layer (new direction — see ROADMAP.md)
- [ ] Decide + scope: Telegram bot + agent comms (separate persistent infra, not serverless)
- [ ] Decide + scope: scheduled autonomous ingest (watch a source, auto-pull new filings)

---

## NOTES
- "Artifact versioning / draft-bleeds-into-persisted" item from earlier was VIDEO BLEED, not this project. No separate artifact table exists; versioning lives on document_versions. Closed.
- Human-in-the-loop manual approval queues (from old v5.0 plan) intentionally SCRAPPED per Cam: autonomy over gatekeeping. QC supervisor escalates only genuine ambiguity.
- Theme toggle / "Dark Reno" toggle items SCRAPPED: dark is now locked, no toggle.

---

## v7.2 — Public API + MCP/OpenAPI integration layer (COMPLETE)

- [x] api_keys table (id, label, keyHash, keyPrefix, scope [read|ingest], lastUsedAt, useCount, createdAt, revokedAt)
- [x] Key generation + hashing (sha256), shown once, prefix stored for display
- [x] Admin tab: create/revoke/list API keys (one-time reveal modal, copy, revoke confirm, explicit error+retry state)
- [x] Shared runGoblinPipeline helper — admin + public ingest now one code path (server/_pipeline.ts)
- [x] Express middleware: validate Bearer/x-api-key, enforce scope, bump useCount + lastUsedAt
- [x] GET /api/public/stats (gauge numbers)
- [x] GET /api/public/documents (filters: recordStatus, caseTag, violationTagSlug, q, sortBy, limit, offset)
- [x] GET /api/public/documents/:id (doc + violation tags + version history; fileKey/uploadedBy redacted on doc AND in version snapshots)
- [x] GET /api/public/violations (taxonomy + counts + latest tagged doc)
- [x] GET /api/public/actors, GET /api/public/timeline
- [x] POST /api/public/ingest (ingest scope only -> shared Goblin pipeline; pending, never auto-publish unless threshold)
- [x] GET /api/public/openapi.json (OpenAPI 3 spec — Hermes bridge)
- [x] GET /api/public/mcp.json (MCP manifest — Codex/Claude/MCP clients)
- [x] vitest: 16 tests — key auth, invalid/revoked, scope enforcement, doc+snapshot redaction, read endpoints, manifests (108/108 total)
- [x] API_ACCESS.md usage docs
- [ ] Checkpoint + deliver
