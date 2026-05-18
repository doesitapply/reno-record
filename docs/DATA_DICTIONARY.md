# The Reno Record — Data Dictionary

**Version:** 2.0 (platform release v4.0, schema migrations 0000–0005)

All tables use MySQL/TiDB via Drizzle ORM. The canonical source of truth is `drizzle/schema.ts`. This document describes every table, column, enum, index, and foreign key relationship.

---

## Table index

| Table | Migration | Purpose |
|---|---|---|
| `users` | 0000 | Manus OAuth accounts and roles |
| `stories` | 0001 | Submitted case narratives |
| `documents` | 0001 | Uploaded evidence files |
| `timeline_events` | 0001 | Chronological case events |
| `actors` | 0001 | Judges, attorneys, officials, institutions |
| `public_records_requests` | 0001 | PRR tracking |
| `agent_tasks` | 0001 | Legacy AI task queue |
| `chat_sessions` | 0002 | Goblin chat session headers |
| `chat_messages` | 0002 | Goblin chat message history |
| `ingest_jobs` | 0002 | Goblin ingest pipeline state |
| `audit_log` | 0003 | Immutable security event log |
| `review_requests` | 0004 | User-initiated correction/removal/redaction requests |
| `agencies` | 0005 | Jurisdiction-generic agency registry |
| `violation_tags` | 0005 | Generic procedural violation taxonomy |
| `document_violation_tags` | 0005 | Source-anchored violation tags on documents |
| `actor_agency_roles` | 0005 | Structured actor role history at agencies |
| `actor_document_links` | 0005 | FK join: actors ↔ documents |
| `actor_timeline_links` | 0005 | FK join: actors ↔ timeline events |

---

## `users`

Stores Manus OAuth user accounts. Created or updated on every successful OAuth callback.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `openId` | VARCHAR(64) | No | — | Manus OAuth identifier. UNIQUE. |
| `name` | TEXT | Yes | NULL | Display name from OAuth |
| `email` | VARCHAR(320) | Yes | NULL | Email from OAuth |
| `loginMethod` | VARCHAR(64) | Yes | NULL | e.g. `"manus"` |
| `role` | ENUM(`user`,`admin`) | No | `user` | Authorization tier |
| `createdAt` | TIMESTAMP | No | NOW() | Account creation |
| `updatedAt` | TIMESTAMP | No | NOW() | Auto-updated on any change |
| `lastSignedIn` | TIMESTAMP | No | NOW() | Updated on each OAuth callback |

**Indexes:** UNIQUE on `openId`.

**Notes:** The project owner's `OWNER_OPEN_ID` is automatically promoted to `admin` role in `upsertUser()`. An admin cannot remove their own admin role (`user.setRole` enforces this).

---

## `stories`

Stores submitted case narratives. Every story defaults to `status: "pending"` and `publicPermission: false`. Nothing is publicly visible until an admin sets both `status: "approved"` and `publicPermission: true`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `submitter_name` | VARCHAR(200) | Yes | NULL | Submitter's real name (admin-only) |
| `alias` | VARCHAR(120) | Yes | NULL | Public alias if submitter prefers |
| `email` | VARCHAR(320) | Yes | NULL | Submitter contact (admin-only) |
| `phone` | VARCHAR(60) | Yes | NULL | Submitter contact (admin-only) |
| `case_number` | VARCHAR(120) | Yes | NULL | Court case number |
| `court` | VARCHAR(200) | Yes | NULL | Court name |
| `department` | VARCHAR(120) | Yes | NULL | Court department |
| `judge` | VARCHAR(200) | Yes | NULL | Presiding judge name |
| `prosecutor` | VARCHAR(200) | Yes | NULL | Prosecutor name |
| `defense_attorney` | VARCHAR(200) | Yes | NULL | Defense attorney name |
| `charges` | TEXT | Yes | NULL | Charge description |
| `date_case_started` | TIMESTAMP | Yes | NULL | Case start date |
| `custody_days` | INT | Yes | NULL | Days in pretrial custody |
| `still_pending` | BOOLEAN | Yes | NULL | Case still pending? |
| `trial_held` | BOOLEAN | Yes | NULL | Trial has been held? |
| `requested_trial` | BOOLEAN | Yes | NULL | Defendant requested trial? |
| `counsel_waived_time` | BOOLEAN | Yes | NULL | Counsel waived speedy trial time? |
| `filings_blocked` | BOOLEAN | Yes | NULL | Filings were blocked or ignored? |
| `asked_self_rep` | BOOLEAN | Yes | NULL | Asked to self-represent? |
| `faretta_handled` | BOOLEAN | Yes | NULL | Faretta hearing conducted properly? |
| `competency_raised` | BOOLEAN | Yes | NULL | Competency issue raised? |
| `competency_context` | TEXT | Yes | NULL | Competency narrative |
| `discovery_missing` | BOOLEAN | Yes | NULL | Discovery withheld or missing? |
| `warrants_used` | BOOLEAN | Yes | NULL | Warrants used in case? |
| `family_harm` | TEXT | Yes | NULL | Description of family impact |
| `summary` | TEXT | Yes | NULL | Short narrative summary |
| `main_issue` | TEXT | Yes | NULL | Primary procedural issue |
| `public_permission` | BOOLEAN | No | `false` | Submitter consented to publication |
| `redaction_confirmed` | BOOLEAN | No | `false` | Submitter confirmed redaction review |
| `status` | ENUM | No | `pending` | Moderation state (see enum below) |
| `reviewer_note` | TEXT | Yes | NULL | Admin note to submitter |
| `featured` | BOOLEAN | No | `false` | Featured as "The Church Record" |
| `slug` | VARCHAR(200) | Yes | NULL | URL slug. UNIQUE. |
| `owner_user_id` | INT | Yes | NULL | FK → `users.id` (submitter) |
| `submitter_ip_hash` | VARCHAR(64) | Yes | NULL | SHA-256 of submitter IP |
| `deleted_at` | TIMESTAMP | Yes | NULL | Soft-delete timestamp |
| `deleted_by` | INT | Yes | NULL | FK → `users.id` (admin who deleted) |
| `editorial_note` | TEXT | Yes | NULL | Admin editorial note (internal) |
| `correction_note` | TEXT | Yes | NULL | Correction context for review requests |
| `created_at` | TIMESTAMP | No | NOW() | Submission time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:**

| Value | Meaning |
|---|---|
| `pending` | Awaiting admin review |
| `approved` | Admin approved; may be public if `publicPermission: true` |
| `rejected` | Admin rejected; submitter notified |
| `needs_changes` | Admin requested changes; submitter notified |

**Indexes:** `stories_status_idx` on `status`; `stories_featured_idx` on `featured`; `stories_owner_idx` on `owner_user_id`.

---

## `documents`

Stores uploaded evidence files. File bytes are in S3; only the key and URL are stored here. Every document defaults to `publicStatus: false`, `reviewStatus: "pending"`, `visibility: "pending_review"`, and `aiPolicy: "no_ai_processing"`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `title` | VARCHAR(300) | No | — | Document title |
| `description` | TEXT | Yes | NULL | Admin or AI-generated description |
| `file_key` | VARCHAR(500) | No | — | S3 object key |
| `file_url` | VARCHAR(600) | No | — | `/manus-storage/{key}` |
| `mime_type` | VARCHAR(120) | Yes | NULL | Validated MIME type |
| `file_size` | BIGINT | Yes | NULL | File size in bytes |
| `source_type` | ENUM | No | `other` | Document classification (see enum) |
| `case_number` | VARCHAR(120) | Yes | NULL | Associated case number |
| `document_date` | TIMESTAMP | Yes | NULL | Date on the document |
| `actor_names` | TEXT | Yes | NULL | Legacy freetext actor names (superseded by `actor_document_links`) |
| `issue_tags` | JSON | Yes | NULL | Legacy freetext tag array (superseded by `document_violation_tags`) |
| `story_id` | INT | Yes | NULL | FK → `stories.id` |
| `public_status` | BOOLEAN | No | `false` | Publicly visible? |
| `review_status` | ENUM | No | `pending` | Moderation state |
| `redaction_status` | ENUM | No | `unverified` | Redaction state |
| `visibility` | ENUM | No | `pending_review` | 7-state visibility machine |
| `ai_policy` | ENUM | No | `no_ai_processing` | Whether Goblin can read this |
| `uploaded_by` | INT | Yes | NULL | FK → `users.id` (uploader) |
| `ai_summary` | TEXT | Yes | NULL | Goblin-drafted summary (advisory) |
| `ai_tags` | JSON | Yes | NULL | Goblin-drafted tags (advisory) |
| `deleted_at` | TIMESTAMP | Yes | NULL | Soft-delete timestamp |
| `deleted_by` | INT | Yes | NULL | FK → `users.id` (admin who deleted) |
| `editorial_note` | TEXT | Yes | NULL | Admin editorial note (internal) |
| `correction_note` | TEXT | Yes | NULL | Correction context for review requests |
| `created_at` | TIMESTAMP | No | NOW() | Upload time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`source_type` enum values:** `court_order`, `motion`, `email`, `transcript`, `warrant`, `public_records_response`, `audio`, `video`, `image`, `jail_record`, `risk_notice`, `other`.

**`review_status` enum values:** `pending`, `approved`, `rejected`.

**`redaction_status` enum values:** `unverified`, `verified`, `needs_redaction`.

**`visibility` enum values (7-state machine):**

| Value | Visible to | Goblin can read? |
|---|---|---|
| `pending_review` | Admin only | No |
| `needs_redaction` | Admin only | No |
| `private_admin_only` | Admin only | No |
| `public_preview` | Everyone | Only if `aiPolicy = goblin_allowed` |
| `receipts_only` | Subscribers (v4+) | Only if `aiPolicy = goblin_allowed` |
| `goblin_allowed` | Admin + Goblin | Yes |
| `rejected` | Admin only | No |

**`ai_policy` enum values:** `no_ai_processing` (default), `goblin_allowed`.

**Indexes:** `documents_source_type_idx` on `source_type`; `documents_review_idx` on `review_status`; `documents_public_idx` on `public_status`.

**Notes:** `actor_names` and `issue_tags` are legacy freetext fields retained for migration compatibility. Structured relationships are now managed via `actor_document_links` and `document_violation_tags`.

---

## `timeline_events`

Stores chronological case events. Each event can link to source documents via the `source_documents` JSON array of document IDs.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `event_date` | TIMESTAMP | No | — | Date of the event |
| `title` | VARCHAR(300) | No | — | Event title |
| `summary` | TEXT | Yes | NULL | Event description |
| `case_number` | VARCHAR(120) | Yes | NULL | Associated case number |
| `story_id` | INT | Yes | NULL | FK → `stories.id` |
| `category` | ENUM | No | `other` | Event category (see enum) |
| `issue_tags` | JSON | Yes | NULL | Array of tag strings |
| `actors` | JSON | Yes | NULL | Legacy freetext actor name array (superseded by `actor_timeline_links`) |
| `status` | ENUM | No | `needs_review` | Verification status |
| `source_documents` | JSON | Yes | NULL | Array of `documents.id` |
| `public_status` | BOOLEAN | No | `false` | Publicly visible? |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`category` enum values:** `state_case`, `federal_case`, `custody`, `motion`, `warrant`, `competency`, `public_records`, `communications`, `election_accountability`, `other`.

**`status` enum values:** `confirmed`, `alleged`, `needs_review`.

**Indexes:** `timeline_date_idx` on `event_date`; `timeline_cat_idx` on `category`.

---

## `actors`

Profiles of judges, attorneys, officials, and institutions involved in documented cases.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `slug` | VARCHAR(160) | No | — | URL slug. UNIQUE. |
| `name` | VARCHAR(200) | No | — | Full name |
| `role` | VARCHAR(200) | Yes | NULL | Title or role (e.g. "District Judge") |
| `agency` | VARCHAR(240) | Yes | NULL | Legacy freetext agency name (superseded by `actor_agency_roles`) |
| `bio` | TEXT | Yes | NULL | Public biography |
| `notes` | TEXT | Yes | NULL | Admin-only notes |
| `status` | ENUM | No | `documented` | Documentation status |
| `judicial_actor` | BOOLEAN | No | `false` | Is this a judicial officer? |
| `public_status` | BOOLEAN | No | `true` | Publicly visible? |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:** `documented`, `alleged`, `needs_review`.

**Notes:** The `agency` freetext column is retained for migration compatibility. Structured agency affiliations are managed via `actor_agency_roles`. `judicial_actor: true` flags judges and magistrates for the Election & Accountability page.

---

## `public_records_requests`

Tracks public records requests (PRRs) submitted to government agencies.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `title` | VARCHAR(300) | No | — | Request title |
| `agency` | VARCHAR(240) | No | — | Agency receiving the request |
| `description` | TEXT | Yes | NULL | Request description |
| `date_sent` | TIMESTAMP | Yes | NULL | Date request was sent |
| `deadline` | TIMESTAMP | Yes | NULL | Legal response deadline |
| `status` | ENUM | No | `sent` | Request status (see enum) |
| `response_summary` | TEXT | Yes | NULL | Summary of response received |
| `legal_basis_for_denial` | TEXT | Yes | NULL | Agency's stated denial basis |
| `status_history` | JSON | Yes | NULL | Array of `{ status, date, note }` status change entries |
| `linked_documents` | JSON | Yes | NULL | Array of `documents.id` |
| `public_status` | BOOLEAN | No | `true` | Publicly visible? |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:** `draft`, `sent`, `awaiting_response`, `overdue`, `partial_response`, `denied`, `produced`, `appealed`, `closed`.

---

## `agent_tasks`

Legacy AI task queue from v1. Stores advisory-only AI output (summaries, tags). Superseded by `ingest_jobs` for new work but retained for historical records.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `task_type` | ENUM | No | — | Task classification |
| `status` | ENUM | No | `pending` | Task state |
| `input_document_id` | INT | Yes | NULL | FK → `documents.id` |
| `input_story_id` | INT | Yes | NULL | FK → `stories.id` |
| `output_json` | JSON | Yes | NULL | AI output (advisory only) |
| `review_note` | TEXT | Yes | NULL | Admin review note |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`task_type` enum values:** `summarize_document`, `tag_document`, `summarize_story`, `tag_story`.

**`status` enum values:** `pending`, `completed`, `failed`, `applied`.

---

## `chat_sessions`

Header records for Docket Goblin chat sessions. One session per admin user at a time (reset via `docketGoblin.resetChat`).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `user_id` | INT | No | — | FK → `users.id` |
| `title` | VARCHAR(240) | Yes | NULL | Session title (auto-generated) |
| `created_at` | TIMESTAMP | No | NOW() | Session start |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

---

## `chat_messages`

Individual messages in a Goblin chat session.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `session_id` | INT | No | — | FK → `chat_sessions.id` |
| `role` | ENUM(`user`,`assistant`,`system`) | No | — | Message author |
| `content` | TEXT | No | — | Message text |
| `metadata` | JSON | Yes | NULL | Optional structured metadata |
| `created_at` | TIMESTAMP | No | NOW() | Message time |

**Indexes:** `chat_messages_session_idx` on `session_id`.

---

## `ingest_jobs`

Tracks the Docket Goblin ingest pipeline for each uploaded file. Created by `docketGoblin.ingest`, resolved by `docketGoblin.approveIngest`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `user_id` | INT | No | — | FK → `users.id` (admin who ingested) |
| `story_id` | INT | Yes | NULL | FK → `stories.id` (optional link) |
| `document_id` | INT | Yes | NULL | FK → `documents.id` (created on ingest) |
| `filename` | VARCHAR(400) | No | — | Original filename |
| `mime_type` | VARCHAR(120) | Yes | NULL | Validated MIME type |
| `file_size` | BIGINT | Yes | NULL | File size in bytes |
| `status` | ENUM | No | `pending` | Pipeline state (see enum) |
| `extracted_text` | TEXT | Yes | NULL | PDF-extracted or raw text |
| `draft_json` | JSON | Yes | NULL | LLM draft output (title, summary, tags, actors, patternSignals, etc.) |
| `timeline_event_id` | INT | Yes | NULL | FK → `timeline_events.id` (if created) |
| `proposed_actors` | JSON | Yes | NULL | Array of actor name strings from LLM |
| `error` | TEXT | Yes | NULL | Error message if `status: "failed"` |
| `created_at` | TIMESTAMP | No | NOW() | Ingest time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:** `pending`, `extracted`, `drafted`, `approved`, `failed`.

**Indexes:** `ingest_jobs_status_idx` on `status`.

**Notes:** On `approveIngest`, the server writes structured `actor_document_links` from `draft_json.actors` and maps `draft_json.patternSignals` to `document_violation_tags` by slug. Both operations are additive and do not replace manual curation.

---

## `audit_log`

Immutable append-only log of every security-relevant action. There is no delete or update procedure for this table.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `actor_user_id` | INT | Yes | NULL | FK → `users.id` (null for system events) |
| `actor_role` | VARCHAR(32) | Yes | NULL | Role at time of action |
| `action` | ENUM | No | — | Action type (see enum below) |
| `target_type` | VARCHAR(32) | Yes | NULL | e.g. `"story"`, `"document"`, `"user"` |
| `target_id` | INT | Yes | NULL | ID of the affected record |
| `metadata` | JSON | Yes | NULL | Old/new values, email outcome, file counts, etc. |
| `ip_hash` | VARCHAR(64) | Yes | NULL | SHA-256 of actor IP (not reversible) |
| `created_at` | TIMESTAMP | No | NOW() | Event time |

**`action` enum values:**

| Value | Trigger |
|---|---|
| `story_submitted` | `story.submit` success |
| `story_approved` | `story.adminUpdate` with `status: "approved"` |
| `story_rejected` | `story.adminUpdate` with `status: "rejected"` |
| `story_changes_requested` | `story.adminUpdate` with `status: "needs_changes"` |
| `story_edited` | `story.adminUpdate` field-level edit |
| `story_soft_deleted` | `story.adminSoftDelete` |
| `story_hard_deleted` | `story.adminHardDelete` |
| `story_restored` | `story.adminRestore` |
| `document_uploaded` | `document.adminUpload` success |
| `document_ingested` | `docketGoblin.ingest` success |
| `document_approved` | `document.adminUpdate` with `reviewStatus: "approved"` or `docketGoblin.approveIngest` |
| `document_rejected` | `document.adminUpdate` with `reviewStatus: "rejected"` |
| `document_edited` | `document.adminUpdate` field-level edit |
| `document_soft_deleted` | `document.adminSoftDelete` |
| `document_hard_deleted` | `document.adminHardDelete` |
| `document_restored` | `document.adminRestore` |
| `visibility_changed` | `document.adminUpdate` with `visibility` change |
| `ai_policy_changed` | `document.adminUpdate` with `aiPolicy` change |
| `admin_role_changed` | `user.setRole` success |
| `upload_rejected` | `_uploadGuard.validateUpload` failure |
| `rate_limit_triggered` | Rate limit exceeded in `story.submit` or `docketGoblin.ingest` |
| `review_request_submitted` | `reviewRequest.submit` success |
| `review_request_resolved` | `reviewRequest.adminResolve` success |
| `inline_edit` | `adminEdit.inlineEdit` generic field-level edit |

**Indexes:** `audit_action_idx` on `action`; `audit_actor_idx` on `actor_user_id`; `audit_target_idx` on `(target_type, target_id)`.

---

## `review_requests`

User-initiated requests to correct, redact, or remove published content. Submitted by authenticated users; resolved by admins.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `requestor_user_id` | INT | No | — | FK → `users.id` |
| `target_type` | ENUM(`story`,`document`) | No | — | Type of record being requested |
| `target_id` | INT | No | — | ID of the target record |
| `request_type` | ENUM | No | — | Type of request (see enum) |
| `status` | ENUM | No | `submitted` | Workflow status (see enum) |
| `reason` | TEXT | No | — | Requestor's stated reason |
| `explanation` | TEXT | Yes | NULL | Additional context |
| `correction_text` | TEXT | Yes | NULL | Proposed correction text |
| `editorial_note` | TEXT | Yes | NULL | Admin resolution note |
| `resolved_by` | INT | Yes | NULL | FK → `users.id` (resolving admin) |
| `resolved_at` | TIMESTAMP | Yes | NULL | Resolution timestamp |
| `created_at` | TIMESTAMP | No | NOW() | Submission time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`request_type` enum values:** `removal`, `correction`, `redaction`, `privacy_concern`, `legal_safety_concern`.

**`status` enum values:** `submitted`, `under_review`, `approved`, `denied`, `resolved_redaction`, `resolved_correction`, `resolved_removal`.

**Indexes:** `review_req_requestor_idx` on `requestor_user_id`; `review_req_target_idx` on `(target_type, target_id)`; `review_req_status_idx` on `status`.

---

## `agencies`

Jurisdiction-generic registry of government agencies, courts, and institutions. Seeded with 10 Washoe County entities as the initial live corpus.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `name` | VARCHAR(300) | No | — | Full agency name |
| `slug` | VARCHAR(200) | No | — | URL slug. UNIQUE. |
| `agency_type` | ENUM | No | `other` | Classification (see enum) |
| `jurisdiction_name` | VARCHAR(200) | Yes | NULL | e.g. "Washoe County" |
| `jurisdiction_type` | ENUM | Yes | `county` | Jurisdiction scope (see enum) |
| `state` | VARCHAR(60) | Yes | NULL | State abbreviation |
| `county` | VARCHAR(120) | Yes | NULL | County name |
| `city` | VARCHAR(120) | Yes | NULL | City name |
| `parent_agency_id` | INT | Yes | NULL | Self-referential FK for sub-agencies |
| `website_url` | VARCHAR(500) | Yes | NULL | Official website |
| `notes` | TEXT | Yes | NULL | Admin notes |
| `public_status` | BOOLEAN | No | `true` | Publicly visible? |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`agency_type` enum values:** `court`, `prosecutor`, `law_enforcement`, `public_defender`, `government_department`, `oversight_body`, `municipality`, `state_agency`, `federal_agency`, `other`.

**`jurisdiction_type` enum values:** `county`, `city`, `state`, `federal`, `multi_jurisdictional`, `other`.

**Indexes:** `agencies_slug_idx` on `slug`; `agencies_type_idx` on `agency_type`.

**Washoe seed labels (v4.0 initial dataset):**

| Slug | Name | Type |
|---|---|---|
| `second-judicial-district-court` | Second Judicial District Court | `court` |
| `washoe-county-district-attorneys-office` | Washoe County District Attorney's Office | `prosecutor` |
| `washoe-county-sheriffs-office` | Washoe County Sheriff's Office | `law_enforcement` |
| `reno-police-department` | Reno Police Department | `law_enforcement` |
| `washoe-county-public-defender` | Washoe County Public Defender | `public_defender` |
| `washoe-county-alternate-public-defender` | Washoe County Alternate Public Defender | `public_defender` |
| `washoe-county-risk-management` | Washoe County Risk Management | `government_department` |
| `city-of-reno` | City of Reno | `municipality` |
| `nevada-attorney-general` | Nevada Attorney General | `state_agency` |
| `nevada-commission-on-judicial-discipline` | Nevada Commission on Judicial Discipline | `oversight_body` |

---

## `violation_tags`

Generic procedural violation taxonomy. Slugs are jurisdiction-neutral; labels and descriptions are human-readable. Source quotes and citations are enforced at the `document_violation_tags` join level, not here.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `slug` | VARCHAR(120) | No | — | Machine-readable identifier. UNIQUE. |
| `label` | VARCHAR(200) | No | — | Human-readable label |
| `description` | TEXT | Yes | NULL | Definition and usage guidance |
| `category` | ENUM | No | `other` | Violation category (see enum) |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |

**`category` enum values:** `constitutional`, `procedural`, `discovery`, `judicial_conduct`, `prosecutorial_conduct`, `law_enforcement`, `public_records`, `civil_rights`, `other`.

**Indexes:** `violation_tags_slug_idx` on `slug`; `violation_tags_category_idx` on `category`.

**v4.0 taxonomy (15 entries):**

| Slug | Category |
|---|---|
| `faretta_self_representation` | `constitutional` |
| `speedy_trial_delay` | `constitutional` |
| `due_process_defect` | `constitutional` |
| `brady_discovery_issue` | `discovery` |
| `competency_proceeding_abuse` | `procedural` |
| `retaliation_first_amendment` | `civil_rights` |
| `warrant_or_bail_defect` | `constitutional` |
| `record_integrity_issue` | `procedural` |
| `nunc_pro_tunc_concern` | `judicial_conduct` |
| `prosecutorial_misconduct` | `prosecutorial_conduct` |
| `judicial_disqualification_bias` | `judicial_conduct` |
| `access_to_courts_interference` | `civil_rights` |
| `fourth_amendment_search_seizure` | `constitutional` |
| `elder_or_caregiver_impact` | `civil_rights` |
| `public_records_noncompliance` | `public_records` |

---

## `document_violation_tags`

Source-anchored violation tags applied to documents. Every row requires a `source_quote` — a direct excerpt from the document supporting the tag. This is the enforcement mechanism against unsupported AI assertions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `document_id` | INT | No | — | FK → `documents.id` |
| `violation_tag_id` | INT | No | — | FK → `violation_tags.id` |
| `source_quote` | TEXT | No | — | **Required.** Direct quote from the document. NOT NULL. |
| `source_citation` | VARCHAR(300) | Yes | NULL | Page, paragraph, exhibit label, etc. |
| `confidence` | INT | No | `100` | 0–100; 100 = human-verified, <100 = AI-suggested |
| `added_by` | ENUM(`human`,`goblin`) | No | `human` | Origin of this tag |
| `added_by_user_id` | INT | Yes | NULL | FK → `users.id` (if human) |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |

**Indexes:** `dvt_document_idx` on `document_id`; `dvt_tag_idx` on `violation_tag_id`.

**Notes:** `source_quote NOT NULL` is the primary guard against unsupported AI assertions. Goblin-generated tags (`added_by: "goblin"`) use the signal description as the quote and a synthetic citation marking them as AI-suggested for human review. Confidence < 100 indicates AI origin.

---

## `actor_agency_roles`

Structured role history linking actors to agencies. Replaces the legacy `actors.agency` freetext field for new entries.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `actor_id` | INT | No | — | FK → `actors.id` |
| `agency_id` | INT | No | — | FK → `agencies.id` |
| `title` | VARCHAR(200) | No | — | Role title at this agency |
| `start_date` | TIMESTAMP | Yes | NULL | Role start date |
| `end_date` | TIMESTAMP | Yes | NULL | Role end date (NULL = current) |
| `is_current` | BOOLEAN | No | `false` | Is this the active role? |
| `notes` | TEXT | Yes | NULL | Admin notes |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**Indexes:** `aar_actor_idx` on `actor_id`; `aar_agency_idx` on `agency_id`.

---

## `actor_document_links`

FK join table linking actors to documents. Replaces the legacy `documents.actor_names` freetext field for new entries. Populated by Docket Goblin `approveIngest` and manual admin curation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `actor_id` | INT | No | — | FK → `actors.id` |
| `document_id` | INT | No | — | FK → `documents.id` |
| `role` | VARCHAR(120) | Yes | NULL | Actor's role in this document (e.g. `subject`, `signatory`, `witness`) |
| `confidence` | INT | No | `100` | 0–100; 100 = human-verified |
| `extracted_from` | VARCHAR(300) | Yes | NULL | Page, paragraph, or exhibit where the link was found |
| `added_by` | ENUM(`human`,`goblin`) | No | `human` | Origin of this link |
| `added_by_user_id` | INT | Yes | NULL | FK → `users.id` (if human) |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |

**Indexes:** `adl_actor_idx` on `actor_id`; `adl_document_idx` on `document_id`.

---

## `actor_timeline_links`

FK join table linking actors to timeline events. Replaces the legacy `timeline_events.actors` freetext JSON array.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | No | — | Surrogate PK |
| `actor_id` | INT | No | — | FK → `actors.id` |
| `timeline_event_id` | INT | No | — | FK → `timeline_events.id` |
| `role` | VARCHAR(120) | Yes | NULL | Actor's role in this event |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |

**Indexes:** `atl_actor_idx` on `actor_id`; `atl_event_idx` on `timeline_event_id`.

---

## Enum quick reference

| Table.Column | Values |
|---|---|
| `users.role` | `user`, `admin` |
| `stories.status` | `pending`, `approved`, `rejected`, `needs_changes` |
| `documents.source_type` | `court_order`, `motion`, `email`, `transcript`, `warrant`, `public_records_response`, `audio`, `video`, `image`, `jail_record`, `risk_notice`, `other` |
| `documents.review_status` | `pending`, `approved`, `rejected` |
| `documents.redaction_status` | `unverified`, `verified`, `needs_redaction` |
| `documents.visibility` | `private_admin_only`, `pending_review`, `needs_redaction`, `public_preview`, `receipts_only`, `goblin_allowed`, `rejected` |
| `documents.ai_policy` | `no_ai_processing`, `goblin_allowed` |
| `timeline_events.category` | `state_case`, `federal_case`, `custody`, `motion`, `warrant`, `competency`, `public_records`, `communications`, `election_accountability`, `other` |
| `timeline_events.status` | `confirmed`, `alleged`, `needs_review` |
| `actors.status` | `documented`, `alleged`, `needs_review` |
| `public_records_requests.status` | `draft`, `sent`, `awaiting_response`, `overdue`, `partial_response`, `denied`, `produced`, `appealed`, `closed` |
| `agent_tasks.task_type` | `summarize_document`, `tag_document`, `summarize_story`, `tag_story` |
| `agent_tasks.status` | `pending`, `completed`, `failed`, `applied` |
| `chat_messages.role` | `user`, `assistant`, `system` |
| `ingest_jobs.status` | `pending`, `extracted`, `drafted`, `approved`, `failed` |
| `audit_log.action` | 24 values — see audit_log table above |
| `review_requests.request_type` | `removal`, `correction`, `redaction`, `privacy_concern`, `legal_safety_concern` |
| `review_requests.status` | `submitted`, `under_review`, `approved`, `denied`, `resolved_redaction`, `resolved_correction`, `resolved_removal` |
| `agencies.agency_type` | `court`, `prosecutor`, `law_enforcement`, `public_defender`, `government_department`, `oversight_body`, `municipality`, `state_agency`, `federal_agency`, `other` |
| `agencies.jurisdiction_type` | `county`, `city`, `state`, `federal`, `multi_jurisdictional`, `other` |
| `violation_tags.category` | `constitutional`, `procedural`, `discovery`, `judicial_conduct`, `prosecutorial_conduct`, `law_enforcement`, `public_records`, `civil_rights`, `other` |
| `document_violation_tags.added_by` | `human`, `goblin` |
| `actor_document_links.added_by` | `human`, `goblin` |
