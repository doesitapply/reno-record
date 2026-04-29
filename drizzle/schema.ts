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
