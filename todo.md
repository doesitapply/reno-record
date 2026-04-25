# The Reno Record — Project TODO

Receipts for Due Process. A public-interest accountability archive for Washoe County.

## Foundations
- [x] Initialize full-stack project (web-db-user)
- [x] Define DB schema: stories, documents, timeline_events, actors, public_records_requests, agent_tasks
- [x] Apply migrations
- [x] Editorial design tokens (deep navy, bone, neon amber, muted red) + serif/sans pairing in index.css
- [x] Global site shell: top nav (Home, The Church Record, Timeline, Evidence, Public Records, Actors, Election, Patterns, Submit, Admin) + footer

## Public site
- [x] Home page (hero, what this is, why it matters, core pattern, featured timeline preview, submit CTA, evidence preview, election preview, footer)
- [x] The Church Record (main story page) with sectioned narrative + key actors
- [x] Interactive Timeline page with category filters
- [x] Evidence Archive: search, filter by type, inline PDF viewer
- [x] Submit Your Story page (intake form + multi-file upload + redaction warnings + consent checkboxes)
- [x] Public Records Tracker (table + status badges)
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
- [x] Server: invokeLLM-based tag + summary draft for documents/stories
- [x] UI: "Run Docket Goblin" button in admin moderation; output stored as advisory only
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
- [ ] Backend: audit.list (filters: actorUserId, action, targetType, dateFrom, dateTo, q), audit.exportCsv (admin), audit.byId
- [ ] Backend: user.adminListWithCounts (joins submission count, document upload count, last-signed-in)
- [ ] Backend: document.adminCounts (visibility buckets: pending_review / needs_redaction / no_ai_processing-tag / goblin_allowed / rejected / receipts_only / public_preview / private_admin_only)
- [ ] Admin UI: Audit Log tab with filters, search, pagination, detail modal, CSV export
- [ ] Admin UI: Users tab with role toggle, lockout-guard message, submission/upload counts
- [ ] Admin UI: visibility quick-counters bar in Documents tab (click-to-filter)
- [ ] Server: server/_email.ts — lazy nodemailer transport behind SMTP env (host/port/user/pass/from); skip + log if missing
- [ ] Email templates (plain text + minimal html): story-received, files-received, story-decision, document-decision; never include private content
- [ ] Wire emails: story.submit success → submitter; document.adminUpdate decision → uploader; story.adminUpdate decision → submitter
- [ ] Audit metadata records email_sent | email_skipped with reason
- [ ] Tests: audit list filters + CSV row shape, user counts, email helper skips when env missing, email body contains no private fields
- [ ] Run full suite, save v3.5 checkpoint
- [ ] Write docs/V4_MONETIZATION.md (spec only — no Stripe code)
