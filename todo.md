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
- [x] Evidence online viewer fixed: `/manus-storage/*` streams files inline and supports HEAD probes

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
