# The Reno Record — Data Dictionary

**Version:** 1.0 (platform release v3.5, schema migrations 0000–0003)

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
| `actor_names` | TEXT | Yes | NULL | Comma-separated actor names |
| `issue_tags` | JSON | Yes | NULL | Array of tag strings |
| `story_id` | INT | Yes | NULL | FK → `stories.id` |
| `public_status` | BOOLEAN | No | `false` | Publicly visible? |
| `review_status` | ENUM | No | `pending` | Moderation state |
| `redaction_status` | ENUM | No | `unverified` | Redaction state |
| `visibility` | ENUM | No | `pending_review` | 7-state visibility machine |
| `ai_policy` | ENUM | No | `no_ai_processing` | Whether Goblin can read this |
| `uploaded_by` | INT | Yes | NULL | FK → `users.id` (uploader) |
| `ai_summary` | TEXT | Yes | NULL | Goblin-drafted summary (advisory) |
| `ai_tags` | JSON | Yes | NULL | Goblin-drafted tags (advisory) |
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
| `actors` | JSON | Yes | NULL | Array of actor name strings |
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
| `agency` | VARCHAR(240) | Yes | NULL | Institution or agency |
| `bio` | TEXT | Yes | NULL | Public biography |
| `notes` | TEXT | Yes | NULL | Admin-only notes |
| `status` | ENUM | No | `documented` | Documentation status |
| `judicial_actor` | BOOLEAN | No | `false` | Is this a judicial officer? |
| `public_status` | BOOLEAN | No | `true` | Publicly visible? |
| `created_at` | TIMESTAMP | No | NOW() | Creation time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:** `documented`, `alleged`, `needs_review`.

**Notes:** `judicial_actor: true` flags judges and magistrates. This flag is used by the Election & Accountability page and the Goblin's proposed actor classification.

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
| `draft_json` | JSON | Yes | NULL | LLM draft output (title, summary, tags, etc.) |
| `timeline_event_id` | INT | Yes | NULL | FK → `timeline_events.id` (if created) |
| `proposed_actors` | JSON | Yes | NULL | Array of actor name strings from LLM |
| `error` | TEXT | Yes | NULL | Error message if `status: "failed"` |
| `created_at` | TIMESTAMP | No | NOW() | Ingest time |
| `updated_at` | TIMESTAMP | No | NOW() | Auto-updated |

**`status` enum values:** `pending`, `extracted`, `drafted`, `approved`, `failed`.

**Indexes:** `ingest_jobs_status_idx` on `status`.

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
| `document_uploaded` | `document.adminUpload` success |
| `document_ingested` | `docketGoblin.ingest` success |
| `document_approved` | `document.adminUpdate` with `reviewStatus: "approved"` or `docketGoblin.approveIngest` |
| `document_rejected` | `document.adminUpdate` with `reviewStatus: "rejected"` |
| `visibility_changed` | `document.adminUpdate` with `visibility` change |
| `ai_policy_changed` | `document.adminUpdate` with `aiPolicy` change |
| `admin_role_changed` | `user.setRole` success |
| `upload_rejected` | `_uploadGuard.validateUpload` failure |
| `rate_limit_triggered` | Rate limit exceeded in `story.submit` or `docketGoblin.ingest` |

**Indexes:** `audit_action_idx` on `action`; `audit_actor_idx` on `actor_user_id`; `audit_target_idx` on `(target_type, target_id)`.

**Notes:** The `metadata` JSON column carries event-specific context. For decision events (`story_approved`, `document_approved`, etc.), it includes `email: "email_sent" | "email_skipped:{reason}"`. For `upload_rejected`, it includes `reason` and `filename`. For `admin_role_changed`, it includes `from`, `to`, and `targetEmail`.

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
| `audit_log.action` | (13 values — see audit_log table above) |
