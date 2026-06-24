import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/* ========== Users (Manus OAuth) ========== */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // v5.0 Stripe + subscription fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
  subscriptionTier: mysqlEnum("subscription_tier", [
    "free", "receipts", "goblin_pro", "founding", "founders_circle",
  ]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscription_status", [
    "active", "trialing", "past_due", "cancelled", "none",
  ]).default("none").notNull(),
  goblinCredits: int("goblin_credits").default(0).notNull(),
  goblinUsedThisMonth: int("goblin_used_this_month").default(0).notNull(),
  goblinFreeUsed: int("goblin_free_used").default(0).notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ========== Stories (public submissions) ========== */
export const stories = mysqlTable(
  "stories",
  {
    id: int("id").autoincrement().primaryKey(),
    submitterName: varchar("submitter_name", { length: 200 }),
    alias: varchar("alias", { length: 120 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 60 }),
    caseNumber: varchar("case_number", { length: 120 }),
    court: varchar("court", { length: 200 }),
    department: varchar("department", { length: 120 }),
    judge: varchar("judge", { length: 200 }),
    prosecutor: varchar("prosecutor", { length: 200 }),
    defenseAttorney: varchar("defense_attorney", { length: 200 }),
    charges: text("charges"),
    dateCaseStarted: timestamp("date_case_started"),
    custodyDays: int("custody_days"),
    stillPending: boolean("still_pending"),
    trialHeld: boolean("trial_held"),
    requestedTrial: boolean("requested_trial"),
    counselWaivedTime: boolean("counsel_waived_time"),
    filingsBlocked: boolean("filings_blocked"),
    askedSelfRep: boolean("asked_self_rep"),
    farettaHandled: boolean("faretta_handled"),
    competencyRaised: boolean("competency_raised"),
    competencyContext: text("competency_context"),
    discoveryMissing: boolean("discovery_missing"),
    warrantsUsed: boolean("warrants_used"),
    familyHarm: text("family_harm"),
    summary: text("summary"),
    mainIssue: text("main_issue"),
    /** consent flags */
    publicPermission: boolean("public_permission").default(false).notNull(),
    redactionConfirmed: boolean("redaction_confirmed").default(false).notNull(),
    /** Moderation */
    status: mysqlEnum("status", ["pending", "approved", "rejected", "needs_changes"])
      .default("pending")
      .notNull(),
    reviewerNote: text("reviewer_note"),
    /** Featured flag for canonical case ("The Church Record") */
    featured: boolean("featured").default(false).notNull(),
    slug: varchar("slug", { length: 200 }).unique(),
    /** v3: who submitted this (FK to users.id; null for legacy/seeded rows) */
    ownerUserId: int("owner_user_id"),
    /** v3: client IP hash for abuse forensics (not raw IP) */
    submitterIpHash: varchar("submitter_ip_hash", { length: 64 }),
    /** v3.8: soft-delete */
    deletedAt: timestamp("deleted_at"),
    deletedBy: int("deleted_by"),
    /** v3.8: editorial notes visible on public page; correction note for substantive changes */
    editorialNote: text("editorial_note"),
    correctionNote: text("correction_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    statusIdx: index("stories_status_idx").on(t.status),
    featuredIdx: index("stories_featured_idx").on(t.featured),
    ownerIdx: index("stories_owner_idx").on(t.ownerUserId),
  }),
);
export type Story = typeof stories.$inferSelect;
export type InsertStory = typeof stories.$inferInsert;

/* ========== Documents (evidence archive) ========== */
export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    fileKey: varchar("file_key", { length: 500 }).notNull(),
    fileUrl: varchar("file_url", { length: 600 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: bigint("file_size", { mode: "number" }),
    sourceType: mysqlEnum("source_type", [
      "court_order",
      "motion",
      "email",
      "transcript",
      "warrant",
      "public_records_response",
      "audio",
      "video",
      "image",
      "jail_record",
      "risk_notice",
      "other",
    ])
      .default("other")
      .notNull(),
    caseNumber: varchar("case_number", { length: 120 }),
    documentDate: timestamp("document_date"),
    actorNames: text("actor_names"),
    issueTags: json("issue_tags").$type<string[]>(),
    storyId: int("story_id"),
    publicStatus: boolean("public_status").default(false).notNull(),
    reviewStatus: mysqlEnum("review_status", ["pending", "approved", "rejected"])
      .default("pending")
      .notNull(),
    redactionStatus: mysqlEnum("redaction_status", ["unverified", "verified", "needs_redaction"])
      .default("unverified")
      .notNull(),
    /** v3 fine-grained visibility (the 7-state machine the spec calls for) */
    visibility: mysqlEnum("visibility", [
      "private_admin_only",
      "pending_review",
      "needs_redaction",
      "public_preview",
      "receipts_only",
      "goblin_allowed",
      "rejected",
    ])
      .default("pending_review")
      .notNull(),
    /** Whether Docket Goblin AI can read this document's text */
    aiPolicy: mysqlEnum("ai_policy", ["no_ai_processing", "goblin_allowed"])
      .default("no_ai_processing")
      .notNull(),
    uploadedBy: int("uploaded_by"),
    aiSummary: text("ai_summary"),
    aiTags: json("ai_tags").$type<string[]>(),
    /** v3.8: soft-delete */
    deletedAt: timestamp("deleted_at"),
    deletedBy: int("deleted_by"),
    /** v3.8: editorial notes visible on public page */
    editorialNote: text("editorial_note"),
    correctionNote: text("correction_note"),
    /** v5.1: which case this document belongs to */
    caseTag: mysqlEnum("case_tag", ["state", "federal", "both"]).default("state").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    sourceTypeIdx: index("documents_source_type_idx").on(t.sourceType),
    reviewIdx: index("documents_review_idx").on(t.reviewStatus),
    publicIdx: index("documents_public_idx").on(t.publicStatus),
  }),
);
export type DocumentRow = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/* ========== Timeline events ========== */
export const timelineEvents = mysqlTable(
  "timeline_events",
  {
    id: int("id").autoincrement().primaryKey(),
    eventDate: timestamp("event_date").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    summary: text("summary"),
    caseNumber: varchar("case_number", { length: 120 }),
    storyId: int("story_id"),
    category: mysqlEnum("category", [
      "state_case",
      "federal_case",
      "custody",
      "motion",
      "warrant",
      "competency",
      "public_records",
      "communications",
      "election_accountability",
      "other",
    ])
      .default("other")
      .notNull(),
    issueTags: json("issue_tags").$type<string[]>(),
    actors: json("actors").$type<string[]>(),
    status: mysqlEnum("status", ["confirmed", "alleged", "needs_review"])
      .default("needs_review")
      .notNull(),
    sourceDocuments: json("source_documents").$type<number[]>(),
    publicStatus: boolean("public_status").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    dateIdx: index("timeline_date_idx").on(t.eventDate),
    catIdx: index("timeline_cat_idx").on(t.category),
  }),
);
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertTimelineEvent = typeof timelineEvents.$inferInsert;

/* ========== Actors ========== */
export const actors = mysqlTable("actors", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 200 }),
  agency: varchar("agency", { length: 240 }),
  bio: text("bio"),
  notes: text("notes"),
  status: mysqlEnum("status", ["documented", "alleged", "needs_review"])
    .default("documented")
    .notNull(),
  judicialActor: boolean("judicial_actor").default(false).notNull(),
  publicStatus: boolean("public_status").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Actor = typeof actors.$inferSelect;
export type InsertActor = typeof actors.$inferInsert;

/* ========== Public Records Requests ========== */
export type PublicRecordsStatusHistoryEntry = {
  date?: string;
  status: "draft" | "sent" | "awaiting_response" | "overdue" | "partial_response" | "denied" | "produced" | "appealed" | "closed";
  note?: string;
};

export const publicRecordsRequests = mysqlTable("public_records_requests", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  agency: varchar("agency", { length: 240 }).notNull(),
  description: text("description"),
  dateSent: timestamp("date_sent"),
  deadline: timestamp("deadline"),
  status: mysqlEnum("status", [
    "draft",
    "sent",
    "awaiting_response",
    "overdue",
    "partial_response",
    "denied",
    "produced",
    "appealed",
    "closed",
  ])
    .default("sent")
    .notNull(),
  responseSummary: text("response_summary"),
  legalBasisForDenial: text("legal_basis_for_denial"),
  statusHistory: json("status_history").$type<PublicRecordsStatusHistoryEntry[]>(),
  linkedDocuments: json("linked_documents").$type<number[]>(),
  /** v5.1: which case this PRR belongs to */
  caseTag: mysqlEnum("case_tag", ["state", "federal", "both"]).default("state").notNull(),
  publicStatus: boolean("public_status").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PublicRecordsRequest = typeof publicRecordsRequests.$inferSelect;
export type InsertPublicRecordsRequest = typeof publicRecordsRequests.$inferInsert;

/* ========== Docket Goblin agent tasks (advisory only) ========== */
export const agentTasks = mysqlTable("agent_tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskType: mysqlEnum("task_type", [
    "summarize_document",
    "tag_document",
    "summarize_story",
    "tag_story",
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "applied"])
    .default("pending")
    .notNull(),
  inputDocumentId: int("input_document_id"),
  inputStoryId: int("input_story_id"),
  outputJson: json("output_json").$type<Record<string, unknown>>(),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;

/* ========== Docket Goblin chat ========== */
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 240 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

export const chatMessages = mysqlTable(
  "chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("session_id").notNull(),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ sessionIdx: index("chat_messages_session_idx").on(t.sessionId) }),
);
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/* ========== Ingest jobs (auto-structuring uploaded evidence) ========== */
export const ingestJobs = mysqlTable(
  "ingest_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    storyId: int("story_id"),
    documentId: int("document_id"),
    filename: varchar("filename", { length: 400 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: bigint("file_size", { mode: "number" }),
    status: mysqlEnum("status", ["pending", "extracted", "drafted", "approved", "failed"])
      .default("pending")
      .notNull(),
    extractedText: text("extracted_text"),
    draftJson: json("draft_json").$type<Record<string, unknown>>(),
    timelineEventId: int("timeline_event_id"),
    proposedActors: json("proposed_actors").$type<string[]>(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({ statusIdx: index("ingest_jobs_status_idx").on(t.status) }),
);
export type IngestJob = typeof ingestJobs.$inferSelect;
export type InsertIngestJob = typeof ingestJobs.$inferInsert;

/* ========== Audit log (v3 — every security-relevant action) ========== */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actor_user_id"),
    actorRole: varchar("actor_role", { length: 32 }),
    action: mysqlEnum("action", [
      "story_submitted",
      "story_approved",
      "story_rejected",
      "story_changes_requested",
      "document_uploaded",
      "document_ingested",
      "document_approved",
      "document_rejected",
      "visibility_changed",
      "ai_policy_changed",
      "admin_role_changed",
      "upload_rejected",
      "rate_limit_triggered",
      "story_edited",
      "story_soft_deleted",
      "story_hard_deleted",
      "story_restored",
      "document_edited",
      "document_soft_deleted",
      "document_hard_deleted",
      "document_restored",
      "review_request_submitted",
      "review_request_resolved",
      "inline_edit",
    ]).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: int("target_id"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    actionIdx: index("audit_action_idx").on(t.action),
    actorIdx: index("audit_actor_idx").on(t.actorUserId),
    targetIdx: index("audit_target_idx").on(t.targetType, t.targetId),
  }),
);
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/* ========== Review Requests (user-initiated correction/removal/redaction) ========== */
export const reviewRequests = mysqlTable(
  "review_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Who submitted the request */
    requestorUserId: int("requestor_user_id").notNull(),
    /** What type of record this concerns */
    targetType: mysqlEnum("target_type", ["story", "document"]).notNull(),
    targetId: int("target_id").notNull(),
    /** Type of request */
    requestType: mysqlEnum("request_type", [
      "removal",
      "correction",
      "redaction",
      "privacy_concern",
      "legal_safety_concern",
    ]).notNull(),
    /** Current workflow status */
    status: mysqlEnum("status", [
      "submitted",
      "under_review",
      "approved",
      "denied",
      "resolved_redaction",
      "resolved_correction",
      "resolved_removal",
    ])
      .default("submitted")
      .notNull(),
    reason: text("reason").notNull(),
    explanation: text("explanation"),
    correctionText: text("correction_text"),
    /** Admin-facing editorial note explaining the resolution */
    editorialNote: text("editorial_note"),
    resolvedBy: int("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    requestorIdx: index("review_req_requestor_idx").on(t.requestorUserId),
    targetIdx: index("review_req_target_idx").on(t.targetType, t.targetId),
    statusIdx: index("review_req_status_idx").on(t.status),
  }),
);
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type InsertReviewRequest = typeof reviewRequests.$inferInsert;

/* ========== Agencies (v4.0 — jurisdiction-generic) ========== */
export const agencies = mysqlTable(
  "agencies",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    agencyType: mysqlEnum("agency_type", [
      "court",
      "prosecutor",
      "law_enforcement",
      "public_defender",
      "government_department",
      "oversight_body",
      "municipality",
      "state_agency",
      "federal_agency",
      "other",
    ])
      .default("other")
      .notNull(),
    jurisdictionName: varchar("jurisdiction_name", { length: 200 }),
    jurisdictionType: mysqlEnum("jurisdiction_type", [
      "county",
      "city",
      "state",
      "federal",
      "multi_jurisdictional",
      "other",
    ]).default("county"),
    state: varchar("state", { length: 60 }),
    county: varchar("county", { length: 120 }),
    city: varchar("city", { length: 120 }),
    parentAgencyId: int("parent_agency_id"),
    websiteUrl: varchar("website_url", { length: 500 }),
    notes: text("notes"),
    publicStatus: boolean("public_status").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    slugIdx: index("agencies_slug_idx").on(t.slug),
    typeIdx: index("agencies_type_idx").on(t.agencyType),
  }),
);
export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = typeof agencies.$inferInsert;

/* ========== Violation Tags (v4.0 — generic taxonomy, source-anchored) ========== */
export const violationTags = mysqlTable(
  "violation_tags",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    label: varchar("label", { length: 200 }).notNull(),
    description: text("description"),
    category: mysqlEnum("category", [
      "constitutional",
      "procedural",
      "discovery",
      "judicial_conduct",
      "prosecutorial_conduct",
      "law_enforcement",
      "public_records",
      "civil_rights",
      "other",
    ])
      .default("other")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: index("violation_tags_slug_idx").on(t.slug),
    categoryIdx: index("violation_tags_category_idx").on(t.category),
  }),
);
export type ViolationTag = typeof violationTags.$inferSelect;
export type InsertViolationTag = typeof violationTags.$inferInsert;

/* ========== Document Violation Tags (v4.0 — source quote required) ========== */
export const documentViolationTags = mysqlTable(
  "document_violation_tags",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull(),
    violationTagId: int("violation_tag_id").notNull(),
    /** Direct quote from the document that supports this tag */
    sourceQuote: text("source_quote").notNull(),
    /** Citation: page number, paragraph, exhibit label, etc. */
    sourceCitation: varchar("source_citation", { length: 300 }),
    /** 0.0–1.0 confidence; 1.0 = human-verified, <1.0 = AI-suggested */
    confidence: int("confidence").default(100).notNull(),
    /** 'human' | 'goblin' */
    addedBy: mysqlEnum("added_by", ["human", "goblin"]).default("human").notNull(),
    addedByUserId: int("added_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    docIdx: index("dvt_document_idx").on(t.documentId),
    tagIdx: index("dvt_tag_idx").on(t.violationTagId),
  }),
);
export type DocumentViolationTag = typeof documentViolationTags.$inferSelect;
export type InsertDocumentViolationTag = typeof documentViolationTags.$inferInsert;

/* ========== Actor Agency Roles (v4.0 — structured role history) ========== */
export const actorAgencyRoles = mysqlTable(
  "actor_agency_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actor_id").notNull(),
    agencyId: int("agency_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    isCurrent: boolean("is_current").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    actorIdx: index("aar_actor_idx").on(t.actorId),
    agencyIdx: index("aar_agency_idx").on(t.agencyId),
  }),
);
export type ActorAgencyRole = typeof actorAgencyRoles.$inferSelect;
export type InsertActorAgencyRole = typeof actorAgencyRoles.$inferInsert;

/* ========== Actor Document Links (v4.0 — FK join, replaces freetext actorNames) ========== */
export const actorDocumentLinks = mysqlTable(
  "actor_document_links",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actor_id").notNull(),
    documentId: int("document_id").notNull(),
    /** Role of the actor in this document: subject, signatory, witness, mentioned, etc. */
    role: varchar("role", { length: 120 }),
    /** 0–100 confidence; 100 = human-verified */
    confidence: int("confidence").default(100).notNull(),
    /** Where was this link extracted from (page, paragraph, exhibit) */
    extractedFrom: varchar("extracted_from", { length: 300 }),
    addedBy: mysqlEnum("added_by", ["human", "goblin"]).default("human").notNull(),
    addedByUserId: int("added_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index("adl_actor_idx").on(t.actorId),
    docIdx: index("adl_document_idx").on(t.documentId),
  }),
);
export type ActorDocumentLink = typeof actorDocumentLinks.$inferSelect;
export type InsertActorDocumentLink = typeof actorDocumentLinks.$inferInsert;

/* ========== Actor Timeline Links (v4.0 — FK join for timeline events) ========== */
export const actorTimelineLinks = mysqlTable(
  "actor_timeline_links",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actor_id").notNull(),
    timelineEventId: int("timeline_event_id").notNull(),
    role: varchar("role", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index("atl_actor_idx").on(t.actorId),
    eventIdx: index("atl_event_idx").on(t.timelineEventId),
  }),
);
export type ActorTimelineLink = typeof actorTimelineLinks.$inferSelect;
export type InsertActorTimelineLink = typeof actorTimelineLinks.$inferInsert;

/* ========== v5.0 — Stripe Subscription Columns on Users ========== */
// NOTE: These are added via ALTER TABLE migration, not a new table.
// The users table above is the source of truth; these columns are added below
// and referenced here for type inference only.
export const userSubscriptionExtension = {
  stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
  subscriptionTier: mysqlEnum("subscription_tier", [
    "free", "receipts", "goblin_pro", "founding", "founders_circle",
  ]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscription_status", [
    "active", "trialing", "past_due", "cancelled", "none",
  ]).default("none").notNull(),
  goblinCredits: int("goblin_credits").default(0).notNull(),
  goblinUsedThisMonth: int("goblin_used_this_month").default(0).notNull(),
  goblinFreeUsed: int("goblin_free_used").default(0).notNull(),
};

/* ========== v5.0 — Contributor XP ========== */
export const contributorXp = mysqlTable(
  "contributor_xp",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    action: mysqlEnum("action", [
      "document_submitted",
      "document_verified",
      "violation_tag_confirmed",
      "first_on_record",
      "pattern_unlock",
      "daily_return",
      "actor_linked",
      "agency_linked",
    ]).notNull(),
    points: int("points").notNull(),
    documentId: int("document_id"),
    actorId: int("actor_id"),
    storyId: int("story_id"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("cxp_user_idx").on(t.userId),
    actionIdx: index("cxp_action_idx").on(t.action),
    createdIdx: index("cxp_created_idx").on(t.createdAt),
  }),
);
export type ContributorXp = typeof contributorXp.$inferSelect;
export type InsertContributorXp = typeof contributorXp.$inferInsert;

/* ========== v5.0 — Badge Definitions ========== */
export const badgeDefinitions = mysqlTable("badge_definitions", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 60 }),
  category: mysqlEnum("category", [
    "contributor", "investigator", "pioneer", "founder", "milestone",
  ]).default("contributor").notNull(),
  threshold: int("threshold").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BadgeDefinition = typeof badgeDefinitions.$inferSelect;
export type InsertBadgeDefinition = typeof badgeDefinitions.$inferInsert;

/* ========== v5.0 — Contributor Badges (earned) ========== */
export const contributorBadges = mysqlTable(
  "contributor_badges",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    badgeSlug: varchar("badge_slug", { length: 120 }).notNull(),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
    metadata: json("metadata"),
  },
  (t) => ({
    userIdx: index("cb_user_idx").on(t.userId),
    slugIdx: index("cb_slug_idx").on(t.badgeSlug),
    uniqueBadge: index("cb_unique_idx").on(t.userId, t.badgeSlug),
  }),
);
export type ContributorBadge = typeof contributorBadges.$inferSelect;
export type InsertContributorBadge = typeof contributorBadges.$inferInsert;

/* ========== v5.0 — Stripe Credit Ledger ========== */
export const creditLedger = mysqlTable(
  "credit_ledger",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    delta: int("delta").notNull(), // positive = credit, negative = debit
    reason: mysqlEnum("reason", [
      "subscription_monthly", "credit_pack_purchase", "goblin_ingest",
      "goblin_chat", "admin_grant", "refund",
    ]).notNull(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 120 }),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("cl_user_idx").on(t.userId),
    createdIdx: index("cl_created_idx").on(t.createdAt),
  }),
);
export type CreditLedger = typeof creditLedger.$inferSelect;
export type InsertCreditLedger = typeof creditLedger.$inferInsert;

/* ========== v6.0 — Judicial Pattern Analysis ========== */

/**
 * Comparative case corpus for judicial pattern analysis.
 * Stores cases from Washoe County Second Judicial District (Dept 6)
 * obtained via NPRA requests, manual download, or public portal.
 * NOT the owner's case — this is the comparative dataset.
 */
export const judicialCases = mysqlTable(
  "judicial_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Washoe County case number, e.g. CR22-1234 */
    caseNumber: varchar("case_number", { length: 120 }).notNull().unique(),
    /** Judge name — allows multi-judge corpus later */
    judgeName: varchar("judge_name", { length: 200 }).notNull(),
    /** Department number */
    department: varchar("department", { length: 60 }),
    caseType: mysqlEnum("case_type", [
      "criminal_felony",
      "criminal_misdemeanor",
      "civil",
      "family",
      "small_claims",
      "other",
    ]).default("other").notNull(),
    /** Was the defendant/respondent pro se at any point? */
    proSeFlag: boolean("pro_se_flag").default(false).notNull(),
    /** Was defendant represented by counsel at any point? */
    representedFlag: boolean("represented_flag").default(false).notNull(),
    filingDate: timestamp("filing_date"),
    dispositionDate: timestamp("disposition_date"),
    dispositionType: mysqlEnum("disposition_type", [
      "convicted",
      "acquitted",
      "dismissed_with_prejudice",
      "dismissed_without_prejudice",
      "settled",
      "transferred",
      "pending",
      "other",
    ]).default("pending").notNull(),
    /** Full text of all minute orders concatenated — NLP target */
    rulingText: text("ruling_text"),
    /** 0.0–1.0: fraction of ruling text matching known boilerplate phrases */
    boilerplateScore: int("boilerplate_score").default(0).notNull(), // stored as 0–100
    /** Minutes from motion filing to ruling (null if not calculable) */
    timeToRulingMinutes: int("time_to_ruling_minutes"),
    /** Source of this record */
    dataSource: mysqlEnum("data_source", [
      "npra_response",
      "manual_download",
      "public_portal",
      "goblin_ingest",
    ]).default("manual_download").notNull(),
    /** Processing status through the Goblin pipeline */
    ingestStatus: mysqlEnum("ingest_status", [
      "pending",
      "text_extracted",
      "boilerplate_scored",
      "complete",
      "failed",
    ]).default("pending").notNull(),
    /** Raw PDF file key in S3 (if uploaded) */
    fileKey: varchar("file_key", { length: 500 }),
    fileUrl: varchar("file_url", { length: 600 }),
    /** Notes from admin review */
    notes: text("notes"),
    /** Whether this case is included in public-facing pattern analysis */
    publicStatus: boolean("public_status").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    judgeIdx: index("jc_judge_idx").on(t.judgeName),
    caseTypeIdx: index("jc_case_type_idx").on(t.caseType),
    proSeIdx: index("jc_pro_se_idx").on(t.proSeFlag),
    ingestIdx: index("jc_ingest_idx").on(t.ingestStatus),
    publicIdx: index("jc_public_idx").on(t.publicStatus),
  }),
);
export type JudicialCase = typeof judicialCases.$inferSelect;
export type InsertJudicialCase = typeof judicialCases.$inferInsert;

/**
 * Boilerplate phrase registry.
 * A phrase is flagged when it appears verbatim (or near-verbatim) in
 * 5+ rulings across different cases — indicating templated, non-individualized review.
 */
export const boilerplatePhrases = mysqlTable(
  "boilerplate_phrases",
  {
    id: int("id").autoincrement().primaryKey(),
    /** The exact phrase or sentence fragment */
    phrase: text("phrase").notNull(),
    /** Normalized hash for deduplication (SHA-256 of lowercased, trimmed phrase) */
    phraseHash: varchar("phrase_hash", { length: 64 }).notNull().unique(),
    /** How many cases in the corpus contain this phrase */
    occurrenceCount: int("occurrence_count").default(0).notNull(),
    /** JSON array of judicial_cases.id values where this phrase appears */
    caseIds: json("case_ids").$type<number[]>(),
    /** Judge this phrase is attributed to */
    judgeName: varchar("judge_name", { length: 200 }),
    /** Is this phrase flagged as a boilerplate signal (vs. standard legal language)? */
    flagged: boolean("flagged").default(false).notNull(),
    /** Category of boilerplate */
    phraseCategory: mysqlEnum("phrase_category", [
      "denial_of_motion",
      "faretta_waiver",
      "competency_finding",
      "continuance_grant",
      "speedy_trial_waiver",
      "pro_se_admonishment",
      "standard_legal_language",
      "other",
    ]).default("other").notNull(),
    /** Admin note explaining why this phrase is significant */
    significance: text("significance"),
    firstSeen: timestamp("first_seen"),
    lastSeen: timestamp("last_seen"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    hashIdx: index("bp_hash_idx").on(t.phraseHash),
    judgeIdx: index("bp_judge_idx").on(t.judgeName),
    flaggedIdx: index("bp_flagged_idx").on(t.flagged),
    countIdx: index("bp_count_idx").on(t.occurrenceCount),
  }),
);
export type BoilerplatePhrase = typeof boilerplatePhrases.$inferSelect;
export type InsertBoilerplatePhrase = typeof boilerplatePhrases.$inferInsert;

/* ========== Case Audit Requests (service intake) ========== */
export const auditRequests = mysqlTable("audit_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  caseNumber: varchar("case_number", { length: 160 }),
  court: varchar("court", { length: 240 }),
  jurisdiction: varchar("jurisdiction", { length: 160 }),
  caseType: mysqlEnum("case_type", ["criminal", "civil", "family", "administrative", "other"])
    .default("criminal")
    .notNull(),
  description: text("description").notNull(),
  objectives: text("objectives"),
  budget: mysqlEnum("budget", ["under_500", "500_2000", "2000_5000", "5000_plus", "discuss"])
    .default("discuss")
    .notNull(),
  status: mysqlEnum("status", ["new", "reviewing", "accepted", "declined", "completed"])
    .default("new")
    .notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AuditRequest = typeof auditRequests.$inferSelect;
export type InsertAuditRequest = typeof auditRequests.$inferInsert;


/* ========== v7.0 Artificially Educated — Operator Platform ========== */

/** Singleton operator profile (Artificially Educated + Cameron Church). Always id=1. */
export const operatorProfile = mysqlTable("operator_profile", {
  id: int("id").autoincrement().primaryKey(),
  /** Umbrella brand, e.g. "Artificially Educated" */
  brand: varchar("brand", { length: 160 }).notNull().default("Artificially Educated"),
  /** Real name anchor */
  fullName: varchar("full_name", { length: 200 }).notNull().default("Cameron Church"),
  /** Role line, e.g. "Systems Architect | Strategic Operator" */
  roleTitle: varchar("role_title", { length: 240 }),
  /** Short punchy tagline / thesis line */
  tagline: varchar("tagline", { length: 400 }),
  /** Longer thesis statement (the "gravity" positioning) */
  thesis: text("thesis"),
  /** Origin story / how we got here — markdown */
  bioMarkdown: text("bio_markdown"),
  location: varchar("location", { length: 160 }),
  /** Contact / social / external links as JSON array of { label, url, icon } */
  links: json("links"),
  /** Avatar storage key (optional) */
  avatarKey: varchar("avatar_key", { length: 400 }),
  /** Hero background image storage key (optional) */
  heroImageKey: varchar("hero_image_key", { length: 400 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OperatorProfile = typeof operatorProfile.$inferSelect;
export type InsertOperatorProfile = typeof operatorProfile.$inferInsert;

/** Build log / capabilities — what the operator has engineered, orchestrated, automated. */
export const buildLogEntries = mysqlTable(
  "build_log_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 280 }).notNull(),
    /** Capability bucket */
    category: mysqlEnum("category", [
      "ai_automation",
      "ai_agents",
      "systems_architecture",
      "legal_tech",
      "data_pipeline",
      "web_platform",
      "infrastructure",
      "other",
    ])
      .default("other")
      .notNull(),
    /** One-line summary shown on cards */
    summary: varchar("summary", { length: 600 }),
    /** Full detail — markdown */
    detailMarkdown: text("detail_markdown"),
    /** Optional outcome metric, e.g. "Cut review time 80%" */
    outcome: varchar("outcome", { length: 400 }),
    eventDate: timestamp("event_date"),
    featured: boolean("featured").default(false).notNull(),
    publicStatus: boolean("public_status").default(true).notNull(),
    sortOrder: int("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    catIdx: index("build_log_category_idx").on(t.category),
    featuredIdx: index("build_log_featured_idx").on(t.featured),
  }),
);
export type BuildLogEntry = typeof buildLogEntries.$inferSelect;
export type InsertBuildLogEntry = typeof buildLogEntries.$inferInsert;

/** Project catalog — apps, tools, systems built under the umbrella brand. */
export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    /** One-line hook */
    tagline: varchar("tagline", { length: 400 }),
    /** Full description — markdown */
    description: text("description"),
    status: mysqlEnum("status", [
      "live",
      "in_development",
      "beta",
      "concept",
      "archived",
    ])
      .default("concept")
      .notNull(),
    /** Operator's role on this project */
    role: varchar("role", { length: 240 }),
    /** Tech stack as JSON array of strings */
    techStack: json("tech_stack"),
    liveUrl: varchar("live_url", { length: 600 }),
    repoUrl: varchar("repo_url", { length: 600 }),
    /** Primary thumbnail storage key */
    thumbnailKey: varchar("thumbnail_key", { length: 400 }),
    /** Additional screenshots as JSON array of { key, caption } */
    screenshots: json("screenshots"),
    /** Parent brand grouping, e.g. "Artificially Educated" */
    parentBrand: varchar("parent_brand", { length: 200 }),
    /** Pin as the flagship exhibit (e.g. The Reno Record) */
    featured: boolean("featured").default(false).notNull(),
    /** Internal vs. self-link to a route on this same site (e.g. "/") */
    internalPath: varchar("internal_path", { length: 300 }),
    publicStatus: boolean("public_status").default(true).notNull(),
    sortOrder: int("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    slugIdx: index("projects_slug_idx").on(t.slug),
    statusIdx: index("projects_status_idx").on(t.status),
    featuredIdx: index("projects_featured_idx").on(t.featured),
  }),
);
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
