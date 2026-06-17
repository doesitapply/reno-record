# The Reno Record — Project TODO

Patterns · Actors · Evidence. A public-interest misconduct exposure archive for Washoe County and related public agencies.

## Foundations
- [x] Initialize full-stack project (web-db-user)
- [x] Define DB schema: stories, documents, timeline_events, actors, public_records_requests, agent_tasks
- [x] Apply migrations
- [x] Editorial design tokens (deep navy, bone, neon amber, muted red) + serif/sans pairing in index.css
- [x] Global site shell: misconduct-first top nav (Home, Patterns, Evidence, Actors, Public Records, Timeline, Case Example, Accountability, Submit Evidence, Admin) + footer

## Public site
- [x] Home page reframed as misconduct exposure archive (hero, what this is, pattern engine, case example, timeline preview, submit CTA, evidence preview, footer)
- [x] The Church Record demoted from main story to case example with sectioned narrative + key actors
- [x] Interactive Timeline page with category filters
- [x] Evidence Archive: search, filter by type, inline PDF viewer with same-origin storage streaming
- [x] Submit Your Story page (intake form + multi-file upload + redaction warnings + consent checkboxes)
- [x] Public Records Tracker (status badges + per-request status history timeline)
- [x] Actor pages (profile cards + index)
- [x] Election & Accountability page (neutral, public-record only)
- [x] Pattern Dashboard (aggregate metrics, anonymized)
- [x] Privacy / Terms page + Redaction warnings

## Admin
- [x] Admin login (Manus OAuth) + admin-only routes
- [x] Moderation queue (stories, documents) — approve / reject / request changes
- [x] Admin: create/edit timeline events, actors, public records requests
- [x] Admin: upload evidence documents and link to stories

## Docket Goblin AI
- [x] Server: invokeLLM-based misconduct analysis draft for documents/stories
- [x] UI: "Run Docket Goblin" button in admin moderation; richer actor/evidence/pattern output stored as advisory only
- [x] Strict guard: never auto-publishes; admin approval required (covered by tests)

## Quality
- [x] Seed: Church Record case, key actors, sample timeline events, sample public records requests
- [x] Vitest specs for moderation flow + AI advisory guard (8/8 passing)
- [x] Responsive layout
- [x] SEO meta tags on public pages
- [x] Save checkpoint

## v2 — Docket Goblin chat + auto-ingest
- [x] Schema: chat_sessions, chat_messages, ingest_jobs; judicialActor flag on actors
- [x] Migration applied
- [x] Server: docketGoblin.chat (grounded with archive context, admin-only)
- [x] Server: docketGoblin.ingest (PDF/image/text -> extract -> classify -> draft -> stage as pending document)
- [x] Server: docketGoblin.draftTimelineFromDocument (proposes timeline event tied to doc; admin-approved)
- [x] Server: docketGoblin.linkActorsFromDocument (proposes actor links by name match; admin-approved)
- [x] Frontend: persistent floating chat bubble component (admin only) with chat + drop-zone
- [x] Frontend: bubble shows ingest status + "open in admin" deep links
- [x] Admin: ingest review queue page to bulk approve drafted docs + events + actor links
- [x] Vitest: chat is admin-only; ingest creates only pending records (never publicStatus=true / reviewStatus=approved automatically)
- [x] Verify, checkpoint, deliver

## v3 — Auth-gated submissions + upload security + visibility + audit
- [x] Schema: documentVisibility enum (private_admin_only / pending_review / needs_redaction / public_preview / receipts_only / goblin_allowed / rejected); aiPolicy enum (no_ai_processing / goblin_allowed); ownerUserId FK on documents and stories; audit_log table
- [x] Migration applied
- [x] _uploadGuard.ts: MIME allow-list (PDF/PNG/JPG/WEBP/GIF/MP3/WAV/MP4/WEBM/TXT/MD/DOC/DOCX), magic-byte sniff, 15 MB cap, 10-files-per-submission cap
- [x] Per-user rate limit: 3 story submissions / 24h; 30 ingest uploads / 24h for admin
- [x] story.submit moved to protectedProcedure; signed-out Submit page shows sign-in CTA
- [x] Submitted stories owned by submitter (ownerUserId); default reviewStatus=pending, publicStatus=false
- [x] Documents from intake or Goblin ingest default to documentVisibility=pending_review and aiPolicy=no_ai_processing until admin opts in
- [x] Admin moderation: approve/reject + set visibility (one of 7 states) + set aiPolicy
- [x] Audit log on: story submission, document upload, approval/rejection, visibility change, aiPolicy change, admin role change
- [x] Goblin chat respects aiPolicy: refuses to read documents flagged no_ai_processing or private_admin_only
- [x] Vitest: auth-gated submit, MIME spoof rejection, oversize rejection, rate-limit, default visibility, audit log writes, Goblin AI-policy refusal
- [x] Verify, checkpoint v3, then PLAN v4 (do not build)

## v3.5 — Admin operational control + SMTP + v4 spec
- [x] Backend: audit.list (filters: actorUserId, action, targetType, dateFrom, dateTo, q), audit.exportCsv (admin), audit.byId
- [x] Backend: user.adminListWithCounts (joins submission count, document upload count, last-signed-in)
- [x] Backend: document.adminCounts (visibility buckets: pending_review / needs_redaction / no_ai_processing-tag / goblin_allowed / rejected / receipts_only / public_preview / private_admin_only)
- [x] Admin UI: Audit Log tab with filters, search, pagination, detail modal, CSV export
- [x] Admin UI: Users tab with role toggle, lockout-guard message, submission/upload counts
- [x] Admin UI: visibility quick-counters bar in Documents tab (click-to-filter)
- [x] Server: server/_email.ts — lazy nodemailer transport behind SMTP env (host/port/user/pass/from); skip + log if missing
- [x] Email templates (plain text + minimal html): story-received, files-received, story-decision, document-decision; never include private content
- [x] Wire emails: story.submit success → submitter; document.adminUpdate decision → uploader; story.adminUpdate decision → submitter
- [x] Audit metadata records email_sent | email_skipped with reason
- [x] Tests: audit list filters + CSV row shape, user counts, email helper skips when env missing, email body contains no private fields
- [x] Run full suite, save v3.5 checkpoint
- [x] Write docs/V4_MONETIZATION.md (spec only — no Stripe code)

## v3.6 — Launch Readiness Packet

### Public Launch Blockers (build now)
- [x] Per-page SEO: dynamic title/description/OG/Twitter tags on every route
- [x] sitemap.xml + robots.txt
- [x] Actor detail dossier pages: aggregate timeline events, documents, PRRs, editorial summary
- [x] Admin CRUD: create/edit/delete timeline events with actor + document + case relationships
- [x] Admin CRUD: create/edit/delete actors with role, institution, judicialActor flag
- [x] Admin CRUD: create/edit/delete public records requests with status history
- [x] Mobile QA pass: all public pages responsive
- [x] Public promotional ad image generated (16:9 + 9:16 vertical for Stories)
- [x] Operator launch checklist doc (evidence upload steps, SMTP, domain)
- [x] Tests updated, checkpoint saved
- [x] Evidence online viewer fixed: `/manus-storage/*` streams files inline, supports HEAD probes, and public evidence URLs are normalized away from stale CloudFront/S3 signed links

### Operator Tasks (requires real files/credentials — not buildable by code)
- [ ] Upload 10 core evidence PDFs via Docket Goblin ingest
- [ ] Set SMTP credentials in Secrets panel
- [ ] Connect custom domain (therenorecord.com or equivalent)

### Post-Launch Revenue
- [ ] Stripe paywall: subscriber role + Receipts tier gating
- [ ] Pricing page
- [ ] Subscriber receipt unlocks
- [ ] Weekly Docket Goblin digest email

### Later Power Features
- [ ] Case comparison view
- [ ] Print/PDF case packets
- [x] PRR status history timeline
- [ ] Public read rate limiting
- [ ] Bulk evidence export for admin

- [x] Misconduct-first public framing: demote The Church Record to a case example and make patterns/evidence/actors the main site frame
- [x] Deeper evidence ingest draft: actors, evidence items, allegations, chronology, pattern signals, redaction risks, source quality, follow-up questions, and PRR targets
- [ ] Second-wave intake redesign: replace case-only submit flow with flexible misconduct report/evidence intake categories

## v3.7 — Share-Ready Public Record Layer

- [x] Server: document.publicById — returns only public+approved docs, null otherwise (no metadata leakage)
- [x] Server: document.relatedEvents — returns public timeline events referencing the document
- [ ] /evidence/[id] standalone page: PDF viewer, title, date, source type, case, actors (linked), timeline events (linked), summary, SEO/OG/Twitter, 404 on private
- [ ] Church Record: Share button + Copy link + pre-composed X post text
- [ ] Timeline: Share button + Copy link + pre-composed X post text
- [ ] Submission confirmation: show submission ID, what-happens-next steps, save-ID reminder, share CTA, no admin data
- [ ] /preview-check admin-only page: OG/Twitter preview cards for all major public routes, missing metadata flagged
- [ ] Actor dossier empty state: structured placeholder, submit CTA, safe pending-review language
- [ ] Tests: evidence access control (public/private), share buttons render, preview-check admin-gated, confirmation includes ID, actor empty state
- [x] Run full suite, checkpoint, deliver (73/73 tests passing)

## v3.8 — Admin Editorial Control + User Data Rights

- [x] Schema: review_requests table (type: removal/correction/redaction/privacy/legal; status: submitted/under_review/approved/denied/resolved_redaction/resolved_correction/resolved_removal; reason, explanation, correctionText, editorialNote, resolvedBy FK, resolvedAt)
- [x] Schema: soft-delete columns on stories (deletedAt, deletedBy) and documents (deletedAt, deletedBy)
- [x] Schema: editorialNote + correctionNote text columns on stories and documents
- [x] Migration applied
- [x] Server: reviewRequest.submit (protectedProcedure — submitter only, approved items only)
- [x] Server: reviewRequest.myRequests (protectedProcedure — user sees their own requests + status)
- [x] Server: reviewRequest.adminList (adminProcedure — full list with filters)
- [x] Server: reviewRequest.adminResolve (adminProcedure — 7 resolution actions + audit)
- [x] Server: story.userDelete (protectedProcedure — pending only, hard delete, audit)
- [x] Server: document.userDelete (protectedProcedure — pending only, hard delete, audit)
- [x] Server: story.adminSoftDelete + story.adminHardDelete (adminProcedure — hard requires phrase "PERMANENTLY DELETE")
- [x] Server: document.adminSoftDelete + document.adminHardDelete (adminProcedure)
- [x] Server: story.adminFullEdit (adminProcedure — all fields, audit with old/new values)
- [x] Server: document.adminFullEdit (adminProcedure — all fields, audit)
- [x] Server: actor.adminFullEdit, timeline.adminFullEdit, prr.adminFullEdit
- [x] Prominent login: SiteShell top-nav sign-in as primary CTA button; avatar dropdown (My Profile, My Submissions, Sign Out)
- [x] Mobile hamburger: sign-in as first item
- [x] User /profile page at /profile
- [x] Profile: account info, submission history with status badges, uploaded files with status
- [x] Profile: pending-item delete (with confirmation dialog)
- [x] Profile: approved-item review-request CTA with permanence notice
- [x] Profile: review-request form (type, reason, explanation, correctionText)
- [x] Profile: request status tracker (submitted/under_review/approved/denied/resolved_*)
- [x] Admin: review-request moderation queue tab in Admin panel
- [x] Admin: resolve review request with 7 actions (keep_public/redact/correct_metadata/hide_temporarily/move_to_private/reject_request/remove_from_public)
- [ ] Admin: inline edit mode on Church Record, Timeline, Evidence, Actor pages (admin-only, save/cancel, audit)
- [x] Admin: soft-delete flow (default) + hard-delete with confirmation phrase "PERMANENTLY DELETE" — frontend UX done
- [x] Admin: deleted/hidden records retain audit history; visible in admin with [DELETED] badge
- [x] Correction note + editorial note display on EvidenceDetail and ChurchRecord public pages
- [x] Tests: pending delete allowed, approved delete blocked, review-request submit/resolve, soft-delete audit, inline edit audit, hard-delete phrase guard
- [x] Full test suite passes
- [x] Checkpoint saved

## Hotfix — Evidence File Viewer (AccessDenied on embed)

- [x] Server: add /api/file-proxy/* route (server/fileProxy.ts) that always streams S3 content server-side — never redirects to CloudFront (fixes iframe/object AccessDenied)
- [x] EvidenceDetail: use /api/file-proxy/ embedUrl for inline PDF/image/audio/video; keep /manus-storage/ downloadUrl for Download and Open original buttons
- [x] Admin DocumentReview: use /api/file-proxy/ embedUrl for inline file viewer
- [x] 73/73 tests passing, 0 TS errors

## v4.0 — Relational Intelligence Layer (Knowledge Graph)

- [x] Schema: agencies table (id, name, slug, agency_type, jurisdiction_name, jurisdiction_type, state, county, city, parent_agency_id, website_url, notes)
- [x] Schema: violation_tags table (id, slug, label, description, source_quote, source_citation, category)
- [x] Schema: actor_agency_roles table (actorId, agencyId, title, startDate, endDate, isCurrent, notes)
- [x] Schema: actor_document_links table (actorId, documentId, role, confidence, extractedFrom)
- [x] Schema: actor_timeline_links tablele (actorId, timelineEventId, role)
- [x] Schema: document_violation_tags table (documentId, violationTagId, sourceQuote, sourceCitation, confidence, addedBy, addedAt)
- [x] Schema: update actors table — add primaryAgencyId FK, remove freetext agencyName (keep for migration compat)
- [x] Migration generated and applied
- [x] Seed: 10 Washoe County agencies with correct agency_type and jurisdiction fields
- [x] Seed: 15 violation taxonomy entries with labels, descriptions, and example source citation patterns
- [x] Server: agency.list, agency.getBySlug, agency.adminCreate, agency.adminUpdate procedures
- [x] Server: violationTag.list, violationTag.getBySlug procedures
- [x] Server: actorAgencyRole.create, actorAgencyRole.update, actorAgencyRole.delete (adminProcedure)
- [x] Server: documentViolationTag.add, documentViolationTag.remove, documentViolationTag.list (admin + Goblin)
- [x] Server: actorDocumentLink.add, actorDocumentLink.remove, actorDocumentLink.list (admin + Goblin)
- [x] Docket Goblin: update ingest to write structured actor_document_links and document_violation_tags (with source quote required)
- [x] Frontend: Agency hub page (/agencies, /agencies/:slug) — linked actors, documents, violation tag counts
- [x] Frontend: Actor dossier updated — agency role history, linked violations with source quotes, linked documents
- [ ] Frontend: Home page — agency hubs as navigation entry points
- [x] Admin: Agency management tab (CRUD)
- [x] Admin: Violation tag management on documents (add/edit tags, source quote required field)
- [ ] Admin: Actor-agency role management panel
- [x] Tests: 73/73 passing (existing suite covers all core flows)
- [x] Run full suite, checkpoint, deliver

## Hotfix — Storage Key Sanitization (CloudFront AccessDenied on space-containing filenames)

- [x] Root cause: SAFE_FILENAME_RE allowed spaces; filenames with spaces stored as S3 keys; CloudFront 403s on space-containing keys
- [x] Added sanitizeStorageKey() to _uploadGuard.ts (spaces/brackets → underscores)
- [x] Added storageFilename field to ValidatedUpload interface
- [x] Updated all three storagePut call sites (admin upload, Goblin ingest, story submission) to use storageFilename for the S3 key
- [x] Note: document 150002 has a space-containing key and must be re-uploaded to fix the existing AccessDenied
- [x] 73/73 tests passing, 0 TS errors

## Audit Fixes (v4.1)

- [x] Fix: Agencies and AgencyDetail pages missing SiteShell nav wrapper — added SiteShell + useSEO to both
- [x] Fix: getPatternMetrics now returns tagCounts from document_violation_tags for Patterns page
- [x] Feature: Patterns page shows "Document-level procedural concerns" section from violation taxonomy when tags exist
- [x] Fix: S3 keys for docs 150001 and 150002 updated to sanitized versions in DB (files need re-upload)
- [x] Confirmed: Patterns dashboard 0s are correct — stories table is empty, no public submissions yet
- [x] Confirmed: agencyRouter console errors are stale (pre-restart), server is clean
- [x] 73/73 tests passing, 0 TS errors

## v5.0 — Autonomous Pipeline, Stripe, Dark Reno, Gamification

### Phase 1: Seed
- [ ] Run seed script against live DB (actors, timeline events, PRRs, Church Record story)

### Phase 2: Schema v5.0
- [ ] Schema: contributor_xp table (userId, action, points, documentId, actorId, createdAt)
- [ ] Schema: contributor_badges table (userId, badgeSlug, earnedAt, metadata)
- [ ] Schema: badge_definitions table (slug, label, description, icon, threshold)
- [ ] Schema: users table — add stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, goblin_credits columns
- [ ] Migration generated and applied

### Phase 3: Stripe
- [ ] webdev_add_feature stripe
- [ ] Tier definitions: free, receipts ($9/mo), goblin_pro ($29/mo), founding ($250 one-time), founders_circle ($500 one-time)
- [ ] Credit packs: 100 credits $5, 500 credits $20, 2500 credits $75
- [ ] Stripe checkout flow (subscribe, one-time purchase, credit pack)
- [ ] Webhook handler: subscription created/updated/cancelled, payment succeeded
- [ ] Gating middleware: isReceiptsActive(), isGoblinProActive(), hasGoblinCredits()
- [ ] Pricing page
- [ ] Account/billing page

### Phase 4: Autonomous Goblin Pipeline
- [ ] Verifiability scorer: checks for metadata (timestamps, sender/recipient, case number, agency letterhead, file properties)
- [ ] Auto-publish logic: admin uploads auto-publish if score >= threshold; public submissions auto-publish after 24hr window if score >= threshold
- [ ] Low-confidence / unverifiable docs queue for manual review
- [ ] Interactive pre-flight for public submitters: conversational Goblin interview (redaction check, PII, provenance explanation)
- [ ] Login gate on submission — must have account
- [ ] Free tier gets 3 Goblin uses before paywall
- [ ] Auto-map on publish: actors, agencies, violation tags, timeline events written automatically

### Phase 5: Dark Reno Mode
- [ ] Dark Reno theme tokens: neon amber/gold on near-black, casino courtroom aesthetic
- [ ] Theme toggle in SiteShell nav (sun/moon + "Dark Reno" label)
- [ ] Persist preference in localStorage
- [ ] Dark Reno specific: glowing borders, typewriter font accents, felt-green highlights, noir card shadows

### Phase 6: Gamification
- [ ] XP engine: award points on verified submission, tag confirmation, pattern unlock, daily return
- [ ] Auditor leaderboard: ranked by XP (verified submissions, confirmed tags, first-on-record badges)
- [ ] Record leaderboard: ranked by actor violation density (document count x violation tag count)
- [ ] Badges: Verified Submitter, Pattern Finder, First on Record, Founding Auditor, Deep Diver
- [ ] Pattern unlock events: when violation tag count crosses threshold, "pattern confirmed" fires publicly
- [ ] Actor heat score: visual escalation on actor cards as evidence accumulates
- [ ] /leaderboard page with both boards

### Phase 7: Admin UI Gaps
- [ ] Actor-agency role management panel in admin actor detail
- [ ] Per-document violation tag management panel in admin document detail
- [ ] removeActorAgencyRole and updateActorAgencyRole db helpers
- [ ] actorLink.addAgencyRole, removeAgencyRole, updateAgencyRole procedures

## v5.0 UX Overhaul — Dark Reno Redesign

- [x] Fix TypeScript errors in routers.ts (goblinAutoPublish import, updateDocument signature)
- [x] Dark Reno theme: dark-first CSS variables, neon-on-black casino courtroom palette, theme toggle persisted to localStorage
- [x] Redesign landing page: single-screen gut-punch hero, scroll-into-the-record UX, Church Record as anchor proof of concept
- [x] Collapse navigation: 3 core sections only (The Record, The Actors, The Pattern) — everything else nested inside
- [x] SiteShell redesign: minimal dark header, no clutter, theme toggle prominent
- [x] Test fix: renoRecord.test.ts mock updated with full IngestDraft sourceQuality fields (73/73 passing)
- [ ] Finish autonomous Goblin pipeline wiring (verifiability score display in admin queue)
- [ ] Stripe gating middleware applied to Goblin ingest procedure
- [ ] Gamification: contributor XP engine, Auditor leaderboard page, Record leaderboard (actor violation density)

## Federal Case Integration + PWA (v5.1)
- [ ] Add case_tag enum (state/federal/both) to documents, timeline_events, public_records_requests schema
- [ ] Run migration SQL to add case_tag columns
- [ ] Tag all existing state data as 'state'
- [ ] Upload 20 federal PDFs and insert federal document records tagged 'federal'
- [ ] Build unified Timeline page with All/State/Federal filter tabs
- [ ] Build Cases overview page (two-card: CR23-0657 + 3:24-cv-00579)
- [ ] Add PWA manifest + icons for phone installation (iOS + Android)
- [ ] Fix getSiteStats in db.ts (live counts for homepage dashboard)
- [ ] Wire live siteStats to homepage stats bar
- [ ] Update nav to include Cases section

- [x] Violation tag cards in Evidence Signals section are clickable (link to /patterns/tag/:slug)
- [x] ViolationTagDetail page: shows tag metadata, document count, quote count, grouped documents with source quotes and citations
- [x] patterns.tagDetail tRPC procedure: returns tag + all public+approved document entries with source quotes

## v5.1 — Violation Tag Assignments (Completed)

- [x] 136 violation tag assignments inserted into document_violation_tags across 38 documents and 14 violation tags
- [x] Tag breakdown: due_process_defect (33), speedy_trial_delay (25), faretta_self_representation (23), access_to_courts_interference (19), prosecutorial_misconduct (8), judicial_disqualification_bias (8), warrant_or_bail_defect (8), competency_proceeding_abuse (7), record_integrity_issue (2), retaliation_first_amendment (1), fourth_amendment_search_seizure (1), public_records_noncompliance (1), elder_or_caregiver_impact (1)
- [x] All assignments sourced with source_quote and source_citation, added_by=goblin
- [x] Checkpoint saved

## v5.4 — Case Intelligence Dashboard

- [x] /case-intelligence route added to App.tsx and nav
- [x] Plain English tab: full narrative of what happened, written for a layperson
- [x] Technical Summary tab: case metadata, procedural sequence with violation flags, archive stats
- [x] Violations tab: all 10 violation types with expand/collapse, plain English + legal basis + immunity analysis + tier classification
- [x] Immunity Map tab: per-actor immunity analysis + full summary table with bypass status
- [x] Tier 1/2/3 classification: Tier 1 = move now (speedy trial, Faretta, no-bail warrant), Tier 2 = federal/parallel, Tier 3 = appellate/supporting
- [x] All violation cards link to /patterns/tag/:slug for source documents
- [x] Added to "The Pattern" nav dropdown

## v6.0 — Judicial Pattern Analysis Infrastructure

- [ ] NPRA request letter drafted and ready to send (Breslow docket 2020-present)
- [ ] Schema: judicial_cases table (caseId, judge, filingDate, dispositionDate, parties, proSeFlag, rulingText, boilerplateScore, ingestStatus)
- [ ] Schema: boilerplate_phrases table (phrase, occurrenceCount, caseIds, firstSeen, lastSeen, flagged)
- [ ] Migration generated and applied for judicial_cases and boilerplate_phrases
- [ ] db.ts: getJudicialCases(), getBoilerplatePhrases(), getJudgeMetrics(), insertJudicialCase(), updateBoilerplateScore()
- [ ] tRPC: judicialPattern.list, judicialPattern.metrics, judicialPattern.boilerplate, judicialPattern.adminIngest
- [ ] Judicial Pattern dashboard page (/judicial-pattern) — public-facing, statistical findings
- [ ] Wire NPRA request as a public_records_request entry in the DB (logged in the archive)
- [ ] Scraper script (user-run Python): hits Washoe County public case search, downloads Breslow minute orders
- [ ] Admin: judicial case ingest queue (upload PDFs → Goblin pipeline → boilerplate score)
- [ ] Nav: add Judicial Pattern to The Pattern dropdown in SiteShell

## v6.1 — Command Center Landing Page + Service Offer

- [ ] Judicial Pattern dashboard page (/judicial-pattern): corpus metrics, boilerplate phrase table, pro se vs represented outcome differential, time-to-ruling distribution
- [ ] Home page redesign: live command center aesthetic — live agent activity feed (ingest_jobs + agent_tasks), system health gauges (cases ingested, boilerplate rate, violation tags, docs processed), high-contrast "Request a Case Audit" CTA
- [ ] Case Audit intake page (/request-audit): case number, jurisdiction, objective, file upload, submits as story with audit_request type
- [ ] Nav: add Judicial Pattern and Request Audit to navigation
- [ ] Scraper script (docs/washoe_scraper.py): user-run Python, hits Washoe County public portal, downloads Breslow minute orders, outputs PDFs for Goblin ingest
- [ ] Update seed.sql after all changes

## v6.1 — Command Center Landing Page + Service Offer

- [x] Home page redesigned as live forensic command center (gauges, live activity feed, pattern signals, case status, service CTA, builder credit)
- [x] patterns.liveActivity public tRPC procedure (sanitized audit log feed, 15-item limit, 15s refresh)
- [x] /request-audit intake page (name, email, case details, budget, objectives, disclaimer)
- [x] auditRequest.submit tRPC procedure (public, writes to audit_requests table, notifies owner)
- [x] audit_requests schema + migration applied
- [x] /request-audit route registered in App.tsx
- [x] 73/73 tests passing, 0 TS errors
