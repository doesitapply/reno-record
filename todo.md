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

---

## v7.3 — Show its own value (COMPLETE)

- [x] Full-text search: globalSearch db helper (docs title/summary/extractedText + actors + timeline + violations), /search page, nav search icon
- [x] UNDATED admin queue: Review Queue tab in AdminManage — accordion rows, inline date+status fix, clear flags, error+retry state
- [x] Version history UI: drawer on EvidenceDetail showing snapshots, restore button (admin only)
- [x] Case report export: /report/:storyId — formatted printable summary (violations, timeline, actors, PRRs, doc list), share link, print/PDF via browser
- [x] Home page reframe: lead with consequence (days held), amber CTA strip (Search / Browse Evidence / Case Overview), gauges retained
- [x] 108/108 tests passing, 0 TS errors
- [ ] Checkpoint + deliver

---

## v7.4 — AI-powered extraction for Review Queue (COMPLETE)

- [x] Backend: `suggestDocumentMetadata` adminProcedure — pulls doc text/metadata, fetches from storage if available, runs classifyDocument + qcReview, returns structured suggestion
- [x] Returns: suggestedDate, dateConfidence, dateConfidenceLabel, dateSourceQuote, suggestedRecordStatus, recordStatusConfidence, recordStatusReason, docketEntryNo, caseNumber, qcNotes, textSource, autoAcceptRecommended
- [x] Non-destructive: writes nothing to DB, admin decides
- [x] Frontend: "AI Suggest" button per doc in Review Queue accordion (violet, Sparkles icon, loading spinner)
- [x] Suggestion card: date + confidence badge + source quote, status + confidence + reason, QC notes, docket/case supplementary
- [x] Apply to form button (pre-fills date + status + note fields with AI values)
- [x] Dismiss button (hides card, shows trigger again)
- [x] AI SUGGESTION READY badge on collapsed header when suggestion is active
- [x] HIGH CONFIDENCE badge when autoAcceptRecommended=true
- [x] 0 TS errors, 108/108 tests
- [ ] Checkpoint + deliver

---

## v7.5 — Show the professional failure narrative (COMPLETE)

- [x] /accountability page: "The Accountability Gap" — role-by-role breakdown (5 defense attorneys, 2 judges, DA, public defender, agencies) with duty vs. documented record, specific violation counts, pro se framing
- [x] Home page: builder credit rewritten — explicit "Built by the defendant" red-border callout, "See who failed and how" CTA linking to /accountability
- [x] Nav: Accountability Gap in The Pattern dropdown
- [x] App.tsx: /accountability route registered
- [x] 0 TS errors, 108/108 tests, checkpoint 54c2e7a2

---

## v7.6 — Actor misconduct intelligence + enhanced profiles

- [ ] actor_news_cache table: actorId, headline, url, source, publishedAt, snippet, fetchedAt, relevanceScore
- [ ] searchActorNews tRPC procedure: query local outlets (RGJ, KRNV, KTVN, 8NewsNow, Nevada Current, Nevada Independent) + general web for actor name + misconduct/complaint/discipline keywords
- [ ] getMisconductProfile procedure: aggregate violation tags from archive + news cache + PRR involvement + document appearances
- [ ] Admin: manual "Refresh News" trigger per actor
- [ ] Public actor profile page /actors/:slug — full misconduct profile: role, case violations, external news, PRR involvement, linked documents
- [ ] Actor list page enhanced: misconduct signal count badge per actor
- [ ] News items marked with source credibility tier (local outlet vs. general web)
- [ ] vitest: news cache schema, misconduct aggregation procedure
- [x] TypeScript clean, checkpoint + deliver

---

## v7.7 — Missing Predicate Report (COMPLETE)

- [x] predicate_findings table: storyId, eventId, eventDate, officialAct, actorName, predicateStatus (located/partial/contradicted/not_located/off_record/needs_review), missingPredicate, whyItMatters, recommendedRequest, severityCategory (liberty/counsel/procedural/administrative), severityScore, confidence, sourceDocIds (JSON), sourceEventIds (JSON), generatedAt, reportVersion
- [x] predicateAnalysisEngine.ts: LLM-powered analysis — for each timeline event, determine expected predicate type, search linked docs/events, classify status, generate court-safe language
- [x] generateMissingPredicateReport tRPC adminProcedure: runs analysis on all events for a story, upserts findings, returns structured report
- [x] getPredicateReport tRPC publicProcedure: returns cached findings for a story
- [x] /missing-predicate page: report table with date/act/actor/source/status/missing/why/request/confidence columns, severity filter chips, source links to evidence pages
- [x] Print/PDF view: clean print stylesheet, court-safe header (case number, generated date, disclaimer)
- [x] CSV export: all columns, downloadable
- [x] Nav: add Missing Predicate Report to The Pattern dropdown
- [x] vitest: report generation returns correct shape, severity ranking correct, language is court-safe (no inflammatory terms)
- [x] TypeScript clean, checkpoint + deliver

---

## v7.8 — Admin Hub (COMPLETE)

- [x] /admin-hub page: unified evidence CRUD overview (documents, timeline, actors, PRRs, agencies) in compact table rows with inline edit/delete
- [x] Documents tab: list all 50 docs with title, date, status, record_status, inline edit fields, reclassify button, hard/soft delete
- [x] Timeline tab: list all 80 events with date, description, category, actor, inline edit, delete
- [x] Actors tab: list all 17 actors with name, role, slug, inline edit, delete — plus actor-document link manager
- [x] PRRs tab: list all PRRs with title, status, date, inline edit, delete
- [x] Agencies tab: list all agencies with name, type, actor roles — add actor role, edit agency
- [x] Batch tools panel: batchClassify (clear undated queue), reclassify single doc, Goblin history per doc
- [x] Wire: evidenceEngine.batchClassify, evidenceEngine.reclassify, adminEdit.inlineEdit, actorLink.addDocumentLink/addTimelineLink/removeDocumentLink, agency.addActorRole, agency.adminUpdate, docketGoblin.listForDocument
- [x] Nav: add Admin Hub to admin nav
- [x] Route: /admin-hub registered in App.tsx
- [x] TypeScript clean, checkpoint + deliver

---

## v7.9 — Landing Page Rebuild (COMPLETE)

- [x] Pull live case facts, top violations, timeline highlights, actor list, PRR count from DB
- [x] Write cover story copy: what happened, why it matters, cited laws/rules
- [x] Write backstory copy: who Cameron is, what they tried to do, what backfired
- [x] Section: Key embarrassments — cited, sourced, court-safe language
- [x] Section: The Numbers — days held, docs filed, violations logged, PRRs ignored
- [x] Section: What the record shows — top 5 violation tags with authority citations
- [x] Section: How to help / what to do with this information
- [x] No duplicate violations — deduplicate by tag type in display
- [x] All factual claims cite authority (rule, statute, case, or docket entry)
- [x] Shareable meta tags (og:title, og:description, og:image)
- [x] Mobile-first, fast, no layout jank
- [x] TypeScript clean, checkpoint + deliver

---

## v7.10 — Event-Level Violation Tagging (in progress)

- [x] Schema: add timelineEventViolationTags table (mirrors documentViolationTags, FK to timeline_events + violation_tags)
- [x] Migration: generate SQL via drizzle-kit, apply via webdev_execute_sql
- [x] Backend: violationTag.addToEvent procedure (adminProcedure)
- [x] Backend: violationTag.removeFromEvent procedure (adminProcedure)
- [x] Backend: violationTag.getEventTags procedure (publicProcedure)
- [x] Backend: violationTag.getEventTagCounts procedure (publicProcedure, deduplicated)
- [x] Backend: update predicateAnalysisEngine to write predicate_findings back to timeline_event_violation_tags
- [x] Admin Hub: violation tag panel on timeline event rows (add/remove tags with sourceQuote + sourceCitation)
- [x] Manual: apply Brady / Discovery Issue tag to Hicks Emails document + Aug 18 bindover timeline event (Hicks event id=240001, tagged brady_discovery_issue confidence=90, addedBy=human)
- [x] Manual: apply Nunc Pro Tunc Concern tag to Aug 18 2023 bindover sequence timeline event (event 150004, tagged nunc_pro_tunc_concern confidence=88, addedBy=human)
- [x] Public Timeline: violation badges per event (colored by category)
- [x] Patterns page: deduplicated event-level counts section added alongside document-level counts
- [ ] Accountability page: event-level signal counts replace document-level counts
- [x] vitest: event tag CRUD, predicate→event tag write-back, deduplication logic (138/138 passing)
- [x] TypeScript clean, checkpoint + deliver

---

## v7.12 — Interactive UI + Timeline Polish + Narrative Layer

- [ ] Homepage: make all metric cards (days detained, motions filed, motions answered, etc.) clickable links to filtered archive/timeline/predicate views
- [ ] Homepage: make pattern gauge chips clickable (link to Patterns page filtered by category)
- [ ] Patterns page: make all tag count rows clickable (link to archive filtered by that violation tag)
- [ ] Patterns page: make chart bars/segments clickable (link to filtered timeline/archive)
- [ ] Timeline: full audit against 154-document archive — fix dates, titles, fill 2026 gaps (Jan–Jul 2026 filings)
- [ ] Timeline: add all 2026 state court events (substitution of attorney, motions to dismiss, disqualification motion, stay order, Dept 6 referral, July 2026 filings)
- [ ] Timeline: add "what was really happening" annotation layer — parallel narrative track per event
- [ ] Narrative Layer: build process-of-elimination analysis for each major claim:
  - [ ] Amended complaint / Nunc Pro Tunc fraud
  - [ ] Brady violation / phone destruction
  - [ ] Judicial silence / non-rulings as deliberate strategy
  - [ ] Counsel failure / alignment with state interests
  - [ ] Competency detour as tactical delay
  - [ ] Warrant posture as coercion mechanism
- [ ] Build "What Really Happened" page with sourced, reasoned conclusions per actor
- [ ] Accountability page: swap to event-level signal counts
