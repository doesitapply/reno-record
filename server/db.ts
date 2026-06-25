import { and, asc, count, desc, eq, gt, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  actors,
  actorAgencyRoles,
  actorDocumentLinks,
  actorTimelineLinks,
  agencies,
  agentTasks,
  auditLog,
  documents,
  documentViolationTags,
  InsertActor,
  InsertActorAgencyRole,
  InsertActorDocumentLink,
  InsertActorTimelineLink,
  InsertAgency,
  InsertAgentTask,
  InsertDocument,
  InsertDocumentViolationTag,
  InsertPublicRecordsRequest,
  InsertStory,
  InsertTimelineEvent,
  InsertUser,
  InsertViolationTag,
  boilerplatePhrases,
  InsertBoilerplatePhrase,
  InsertJudicialCase,
  judicialCases,
  publicRecordsRequests,
  stories,
  timelineEvents,
  users,
  violationTags,
  contributorXp,
  contributorBadges,
  badgeDefinitions,
  operatorProfile,
  buildLogEntries,
  projects,
  filingPackages,
  documentVersions,
  InsertOperatorProfile,
  InsertBuildLogEntry,
  InsertProject,
  InsertFilingPackage,
  InsertDocumentVersion,
  DocumentRow,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/* ================= Users ================= */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

/* ================= Stories ================= */
export async function insertStory(input: InsertStory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(stories).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function listStoriesByStatus(status: "pending" | "approved" | "rejected" | "needs_changes") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stories).where(eq(stories.status, status)).orderBy(desc(stories.createdAt));
}
export async function listAllStories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stories).orderBy(desc(stories.createdAt));
}
export async function getStoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  return r[0] ?? null;
}
export async function getStoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);
  return r[0] ?? null;
}
export async function getFeaturedStory() {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .select()
    .from(stories)
    .where(and(eq(stories.featured, true), eq(stories.status, "approved")))
    .limit(1);
  return r[0] ?? null;
}
export async function updateStory(id: number, patch: Partial<InsertStory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stories).set(patch).where(eq(stories.id, id));
}

/* ================= Documents ================= */
export async function insertDocument(input: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(documents).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function listPublicDocuments(opts: {
  q?: string;
  sourceType?: string;
  caseTag?: string;
  recordStatus?: string;
  violationTagSlug?: string;
  sortBy?: "date_desc" | "date_asc";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")];
  if (opts.sourceType && opts.sourceType !== "all") {
    filters.push(eq(documents.sourceType, opts.sourceType as any));
  }
  if (opts.caseTag && opts.caseTag !== "all") {
    filters.push(eq(documents.caseTag, opts.caseTag as any));
  }
  if (opts.recordStatus && opts.recordStatus !== "all") {
    filters.push(eq(documents.recordStatus, opts.recordStatus as any));
  }
  if (opts.q && opts.q.trim()) {
    const q = `%${opts.q.trim()}%`;
    filters.push(
      or(
        like(documents.title, q),
        like(documents.description, q),
        like(documents.actorNames, q),
        like(documents.caseNumber, q),
      )!,
    );
  }
  // Filter by violation tag slug via subquery
  if (opts.violationTagSlug && opts.violationTagSlug !== "all") {
    const tag = await db
      .select({ id: violationTags.id })
      .from(violationTags)
      .where(eq(violationTags.slug, opts.violationTagSlug))
      .limit(1);
    if (tag.length === 0) return [];
    const tagId = tag[0].id;
    const taggedDocIds = await db
      .selectDistinct({ docId: documentViolationTags.documentId })
      .from(documentViolationTags)
      .where(eq(documentViolationTags.violationTagId, tagId));
    if (taggedDocIds.length === 0) return [];
    const ids = taggedDocIds.map((r) => r.docId);
    filters.push(sql`${documents.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  }
  const orderBy = opts.sortBy === "date_asc" ? asc(documents.documentDate) : desc(documents.documentDate);
  return db
    .select()
    .from(documents)
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(opts.limit ?? 200);
}

/** Returns counts per source_type, violation_tag, and case_tag for the public filter sidebar */
export async function getDocumentFilterMeta() {
  const db = await getDb();
  if (!db) return { bySourceType: [] as any[], byViolationTag: [] as any[], byCaseTag: [] as any[], byRecordStatus: [] as any[] };
  const [bySourceType, byViolationTag, byCaseTag, byRecordStatus] = await Promise.all([
    db
      .select({ sourceType: documents.sourceType, cnt: count() })
      .from(documents)
      .where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")))
      .groupBy(documents.sourceType),
    db
      .select({ slug: violationTags.slug, label: violationTags.label, cnt: count() })
      .from(documentViolationTags)
      .innerJoin(violationTags, eq(documentViolationTags.violationTagId, violationTags.id))
      .innerJoin(documents, eq(documentViolationTags.documentId, documents.id))
      .where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")))
      .groupBy(violationTags.slug, violationTags.label)
      .orderBy(desc(count())),
    db
      .select({ caseTag: documents.caseTag, cnt: count() })
      .from(documents)
      .where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")))
      .groupBy(documents.caseTag),
    db
      .select({ recordStatus: documents.recordStatus, cnt: count() })
      .from(documents)
      .where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")))
      .groupBy(documents.recordStatus),
  ]);
  return { bySourceType, byViolationTag, byCaseTag, byRecordStatus };
}
export async function listAllDocuments(filter?: {
  visibility?: string;
  aiPolicy?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [];
  if (filter?.visibility) conds.push(eq(documents.visibility, filter.visibility as any));
  if (filter?.aiPolicy) conds.push(eq(documents.aiPolicy, filter.aiPolicy as any));
  let q: any = db.select().from(documents);
  if (conds.length === 1) q = q.where(conds[0]);
  else if (conds.length > 1) q = q.where(and(...conds));
  return q.orderBy(desc(documents.createdAt));
}
export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return r[0] ?? null;
}
export async function updateDocument(id: number, patch: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(patch).where(eq(documents.id, id));
}

/* ================= Timeline events ================= */
export async function insertTimelineEvent(input: InsertTimelineEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(timelineEvents).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function listPublicTimeline(opts: { category?: string; storyId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(timelineEvents.publicStatus, true)];
  if (opts.category && opts.category !== "all") {
    filters.push(eq(timelineEvents.category, opts.category as any));
  }
  if (opts.storyId) filters.push(eq(timelineEvents.storyId, opts.storyId));
  return db
    .select()
    .from(timelineEvents)
    .where(and(...filters))
    .orderBy(asc(timelineEvents.eventDate));
}
export async function listAllTimelineEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(timelineEvents).orderBy(asc(timelineEvents.eventDate));
}
export async function updateTimelineEvent(id: number, patch: Partial<InsertTimelineEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(timelineEvents).set(patch).where(eq(timelineEvents.id, id));
}
export async function deleteTimelineEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(timelineEvents).where(eq(timelineEvents.id, id));
}

/* ================= Actors ================= */
export async function insertActor(input: InsertActor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(actors).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function listPublicActors() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(actors)
    .where(eq(actors.publicStatus, true))
    .orderBy(asc(actors.name));
}
export async function getActorBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(actors).where(eq(actors.slug, slug)).limit(1);
  return r[0] ?? null;
}
export async function updateActor(id: number, patch: Partial<InsertActor>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(actors).set(patch).where(eq(actors.id, id));
}
export async function deleteActor(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(actors).where(eq(actors.id, id));
}

/* ================= Public records requests ================= */
export async function insertPRR(input: InsertPublicRecordsRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db
    .insert(publicRecordsRequests)
    .values(input)) as unknown as [{ insertId: number }];
  return insertId;
}
export async function listPublicPRRs() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(publicRecordsRequests)
    .where(eq(publicRecordsRequests.publicStatus, true))
    .orderBy(desc(publicRecordsRequests.dateSent));
}
export async function listAllPRRs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publicRecordsRequests).orderBy(desc(publicRecordsRequests.dateSent));
}
export async function updatePRR(id: number, patch: Partial<InsertPublicRecordsRequest>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(publicRecordsRequests).set(patch).where(eq(publicRecordsRequests.id, id));
}
export async function deletePRR(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(publicRecordsRequests).where(eq(publicRecordsRequests.id, id));
}

/* ================= Agent tasks (Docket Goblin advisory) ================= */
export async function insertAgentTask(input: InsertAgentTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(agentTasks).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function listAgentTasksForDocument(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.inputDocumentId, documentId))
    .orderBy(desc(agentTasks.createdAt));
}
export async function listAgentTasksForStory(storyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.inputStoryId, storyId))
    .orderBy(desc(agentTasks.createdAt));
}

/* ================= Aggregates (Pattern Dashboard) ================= */
export async function getPatternMetrics() {
  const db = await getDb();
  if (!db)
    return {
      submitted: 0,
      approved: 0,
      pending: 0,
      over1y: 0,
      over2y: 0,
      over3y: 0,
      custodyOver30: 0,
      custodyOver60: 0,
      custodyOver100: 0,
      farettaIssues: 0,
      speedyTrialIssues: 0,
      competencyAfterAssertion: 0,
      noBailWarrant: 0,
      discoveryIssues: 0,
      ignoredFilings: 0,
      familyHarm: 0,
    };
  const [agg] = await db
    .select({
      submitted: sql<number>`COUNT(*)`,
      approved: sql<number>`SUM(CASE WHEN ${stories.status} = 'approved' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${stories.status} = 'pending' THEN 1 ELSE 0 END)`,
      over1y: sql<number>`SUM(CASE WHEN ${stories.dateCaseStarted} IS NOT NULL AND DATEDIFF(NOW(), ${stories.dateCaseStarted}) >= 365 THEN 1 ELSE 0 END)`,
      over2y: sql<number>`SUM(CASE WHEN ${stories.dateCaseStarted} IS NOT NULL AND DATEDIFF(NOW(), ${stories.dateCaseStarted}) >= 730 THEN 1 ELSE 0 END)`,
      over3y: sql<number>`SUM(CASE WHEN ${stories.dateCaseStarted} IS NOT NULL AND DATEDIFF(NOW(), ${stories.dateCaseStarted}) >= 1095 THEN 1 ELSE 0 END)`,
      custodyOver30: sql<number>`SUM(CASE WHEN ${stories.custodyDays} >= 30 THEN 1 ELSE 0 END)`,
      custodyOver60: sql<number>`SUM(CASE WHEN ${stories.custodyDays} >= 60 THEN 1 ELSE 0 END)`,
      custodyOver100: sql<number>`SUM(CASE WHEN ${stories.custodyDays} >= 100 THEN 1 ELSE 0 END)`,
      farettaIssues: sql<number>`SUM(CASE WHEN ${stories.askedSelfRep} = 1 AND (${stories.farettaHandled} IS NULL OR ${stories.farettaHandled} = 0) THEN 1 ELSE 0 END)`,
      speedyTrialIssues: sql<number>`SUM(CASE WHEN ${stories.requestedTrial} = 1 AND ${stories.trialHeld} = 0 THEN 1 ELSE 0 END)`,
      competencyAfterAssertion: sql<number>`SUM(CASE WHEN ${stories.competencyRaised} = 1 AND ${stories.askedSelfRep} = 1 THEN 1 ELSE 0 END)`,
      noBailWarrant: sql<number>`SUM(CASE WHEN ${stories.warrantsUsed} = 1 THEN 1 ELSE 0 END)`,
      discoveryIssues: sql<number>`SUM(CASE WHEN ${stories.discoveryMissing} = 1 THEN 1 ELSE 0 END)`,
      ignoredFilings: sql<number>`SUM(CASE WHEN ${stories.filingsBlocked} = 1 THEN 1 ELSE 0 END)`,
      familyHarm: sql<number>`SUM(CASE WHEN ${stories.familyHarm} IS NOT NULL AND CHAR_LENGTH(${stories.familyHarm}) > 0 THEN 1 ELSE 0 END)`,
    })
    .from(stories);

  // v6.4: violation tag counts — COUNT DISTINCT documentId so a document tagged with the
  // same violation multiple times (e.g. by Goblin + human) only counts once per tag type.
  // This prevents inflation and ensures the signal count = unique evidence files, not assignments.
  // v6.4.2: also surface the most-recently-tagged document (title + date) for hover tooltips.
  const tagCounts = await db
    .select({
      slug: violationTags.slug,
      label: violationTags.label,
      count: sql<number>`COUNT(DISTINCT ${documentViolationTags.documentId})`,
      latestDocTitle: sql<string | null>`(
        SELECT d.title FROM documents d
        INNER JOIN document_violation_tags dvt2 ON dvt2.document_id = d.id
        WHERE dvt2.violation_tag_id = ${violationTags.id}
          AND d.public_status = 1
          AND d.review_status = 'approved'
        ORDER BY COALESCE(d.document_date, d.created_at) DESC
        LIMIT 1
      )`,
      latestDocDate: sql<string | null>`(
        SELECT COALESCE(d.document_date, d.created_at) FROM documents d
        INNER JOIN document_violation_tags dvt2 ON dvt2.document_id = d.id
        WHERE dvt2.violation_tag_id = ${violationTags.id}
          AND d.public_status = 1
          AND d.review_status = 'approved'
        ORDER BY COALESCE(d.document_date, d.created_at) DESC
        LIMIT 1
      )`,
    })
    .from(violationTags)
    .leftJoin(documentViolationTags, eq(documentViolationTags.violationTagId, violationTags.id))
    .groupBy(violationTags.id, violationTags.slug, violationTags.label)
    .orderBy(desc(sql`COUNT(DISTINCT ${documentViolationTags.documentId})`));

  return { ...(agg as any), tagCounts };
}


/* ================= Chat (Docket Goblin) ================= */
import {
  chatMessages,
  chatSessions,
  ingestJobs,
  InsertChatMessage,
  InsertChatSession,
  InsertIngestJob,
} from "../drizzle/schema";

export async function insertChatSession(input: InsertChatSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(chatSessions).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function getOrCreateLatestChatSession(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const r = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);
  if (r[0]) return r[0];
  const id = await insertChatSession({ userId, title: "Docket Goblin chat" });
  const r2 = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
  return r2[0]!;
}
export async function listChatMessages(sessionId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
}
export async function appendChatMessage(input: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(chatMessages).values(input)) as unknown as [
    { insertId: number },
  ];
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, input.sessionId));
  return insertId;
}

/* ================= Ingest jobs ================= */
export async function insertIngestJob(input: InsertIngestJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(ingestJobs).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}
export async function updateIngestJob(id: number, patch: Partial<InsertIngestJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ingestJobs).set(patch).where(eq(ingestJobs.id, id));
}
export async function getIngestJob(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(ingestJobs).where(eq(ingestJobs.id, id)).limit(1);
  return r[0] ?? null;
}
export async function listIngestJobs(opts: { status?: string; limit?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const filters: any[] = [];
  if (opts.status && opts.status !== "all") {
    filters.push(eq(ingestJobs.status, opts.status as any));
  }
  let q = db.select().from(ingestJobs) as any;
  if (filters.length) q = q.where(and(...filters));
  return q.orderBy(desc(ingestJobs.createdAt)).limit(opts.limit ?? 100);
}

/* ================= Lookups for Docket Goblin chat context =================
   AI Policy enforcement (v3): the Goblin can ONLY see documents that admin
   has explicitly flagged ai_policy='goblin_allowed'. Anything else is hidden
   from the LLM context entirely — not just summarized differently. */
export async function getArchiveContextForLLM() {
  const db = await getDb();
  if (!db) return null;
  const [storiesRows, docsRows, eventsRows, actorsRows, prrRows] = await Promise.all([
    db
      .select()
      .from(stories)
      .where(and(eq(stories.status, "approved"), eq(stories.publicPermission, true)))
      .orderBy(desc(stories.createdAt))
      .limit(20),
    db
      .select()
      .from(documents)
      .where(eq(documents.aiPolicy, "goblin_allowed"))
      .orderBy(desc(documents.createdAt))
      .limit(60),
    db.select().from(timelineEvents).orderBy(asc(timelineEvents.eventDate)).limit(80),
    db.select().from(actors).orderBy(asc(actors.name)).limit(50),
    db.select().from(publicRecordsRequests).orderBy(desc(publicRecordsRequests.createdAt)).limit(30),
  ]);
  return { stories: storiesRows, documents: docsRows, events: eventsRows, actors: actorsRows, prrs: prrRows };
}

export async function findActorIdsByNames(names: string[]) {
  const db = await getDb();
  if (!db || names.length === 0) return [];
  const lower = names.map((n) => n.toLowerCase().trim()).filter(Boolean);
  const all = await db.select().from(actors);
  return all
    .filter((a) =>
      lower.some(
        (n) =>
          a.name.toLowerCase().includes(n) ||
          (a.role || "").toLowerCase().includes(n) ||
          (a.agency || "").toLowerCase().includes(n),
      ),
    )
    .map((a) => ({ id: a.id, slug: a.slug, name: a.name }));
}


/* ================= User role management (v3 audit-traceable) ================= */
export async function setUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(500);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0] ?? null;
}


/* ================= Audit log queries ================= */
export type AuditFilter = {
  actorUserId?: number;
  action?: string;
  targetType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  q?: string;
  limit?: number;
  offset?: number;
};

function buildAuditWhere(opts: AuditFilter) {
  const filters: any[] = [];
  if (opts.actorUserId) filters.push(eq(auditLog.actorUserId, opts.actorUserId));
  if (opts.action && opts.action !== "all") filters.push(eq(auditLog.action, opts.action as any));
  if (opts.targetType && opts.targetType !== "all")
    filters.push(eq(auditLog.targetType, opts.targetType));
  if (opts.dateFrom) filters.push(gte(auditLog.createdAt, opts.dateFrom));
  if (opts.dateTo) filters.push(lte(auditLog.createdAt, opts.dateTo));
  if (opts.q && opts.q.trim()) {
    const q = `%${opts.q.trim()}%`;
    filters.push(
      or(
        like(auditLog.action, q),
        like(auditLog.targetType, q),
        like(sql`CAST(${auditLog.metadata} AS CHAR)`, q),
      ),
    );
  }
  return filters.length ? and(...filters) : undefined;
}

export async function listAuditLog(opts: AuditFilter) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const where = buildAuditWhere(opts);
  const limit = Math.min(opts.limit ?? 50, 500);
  const offset = opts.offset ?? 0;

  const baseSelect = db.select().from(auditLog);
  const baseCount = db.select({ c: count() }).from(auditLog);

  const [rows, totalRow] = await Promise.all([
    where
      ? baseSelect.where(where).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset)
      : baseSelect.orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
    where ? baseCount.where(where) : baseCount,
  ]);

  return { rows, total: Number(totalRow[0]?.c ?? 0) };
}

export async function exportAuditLog(opts: AuditFilter) {
  // Same filter, no pagination, capped at 10k rows for safety.
  const { rows } = await listAuditLog({ ...opts, limit: 10000, offset: 0 });
  return rows;
}

/* ================= User management with counts ================= */
export async function listUsersWithCounts() {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(500);
  if (allUsers.length === 0) return [];

  const ids = allUsers.map((u) => u.id);

  // Story counts per ownerUserId
  const storyCounts = await db
    .select({ id: stories.ownerUserId, c: count() })
    .from(stories)
    .where(or(...ids.map((id) => eq(stories.ownerUserId, id))))
    .groupBy(stories.ownerUserId);

  // Document counts per uploadedBy
  const docCounts = await db
    .select({ id: documents.uploadedBy, c: count() })
    .from(documents)
    .where(or(...ids.map((id) => eq(documents.uploadedBy, id))))
    .groupBy(documents.uploadedBy);

  const sMap = new Map<number, number>();
  for (const r of storyCounts) if (r.id) sMap.set(r.id, Number(r.c));
  const dMap = new Map<number, number>();
  for (const r of docCounts) if (r.id) dMap.set(r.id, Number(r.c));

  return allUsers.map((u) => ({
    ...u,
    submissionCount: sMap.get(u.id) ?? 0,
    uploadCount: dMap.get(u.id) ?? 0,
  }));
}

/* ================= Document review-state counters ================= */
export async function documentVisibilityCounts() {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ v: documents.visibility, c: count() })
    .from(documents)
    .groupBy(documents.visibility);
  const aiPolicyRows = await db
    .select({ p: documents.aiPolicy, c: count() })
    .from(documents)
    .groupBy(documents.aiPolicy);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.v)] = Number(r.c);
  for (const r of aiPolicyRows) out[`ai:${String(r.p)}`] = Number(r.c);
  return out;
}

/* ================= Actor Dossier ================= */
/**
 * Aggregates all public timeline events, documents, and PRRs that mention
 * an actor by name. Used to build the dossier view on actor detail pages.
 */
export async function getActorDossier(actorName: string) {
  const db = await getDb();
  if (!db) return { events: [], documents: [], prrs: [] };

  // Timeline events where actors JSON array contains the actor name
  const allEvents = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.publicStatus, true))
    .orderBy(asc(timelineEvents.eventDate));

  const events = allEvents.filter((e) => {
    if (!e.actors) return false;
    const arr = Array.isArray(e.actors) ? e.actors : [];
    return arr.some((a: string) => a.toLowerCase().includes(actorName.toLowerCase()));
  });

  // Documents where actorNames text contains the actor name
  const allDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicStatus, true),
        eq(documents.reviewStatus, "approved"),
      ),
    )
    .orderBy(desc(documents.documentDate));

  const actorDocs = allDocs.filter((d) => {
    if (!d.actorNames) return false;
    return d.actorNames.toLowerCase().includes(actorName.toLowerCase());
  });

  // PRRs where agency or description contains the actor name
  const allPrrs = await db
    .select()
    .from(publicRecordsRequests)
    .where(eq(publicRecordsRequests.publicStatus, true))
    .orderBy(desc(publicRecordsRequests.dateSent));

  const actorPrrs = allPrrs.filter((p) => {
    const haystack = `${p.agency ?? ""} ${p.description ?? ""} ${p.title ?? ""}`.toLowerCase();
    return haystack.includes(actorName.toLowerCase());
  });

  return { events, documents: actorDocs, prrs: actorPrrs };
}

export async function listAllActors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actors).orderBy(asc(actors.name));
}

export async function getRelatedTimelineEvents(docId: number) {
  const db = await getDb();
  if (!db) return [];
  // sourceDocuments is a JSON array of document IDs stored as text
  // MySQL JSON_CONTAINS is the right tool here
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.publicStatus, true),
        sql`JSON_CONTAINS(${timelineEvents.sourceDocuments}, CAST(${docId} AS JSON), '$')`
      )
    )
    .orderBy(asc(timelineEvents.eventDate));
  return rows;
}


/* ================= Review Requests (v3.8) ================= */
import {
  reviewRequests,
  InsertReviewRequest,
  ReviewRequest,
} from "../drizzle/schema";

export async function createReviewRequest(
  data: Omit<InsertReviewRequest, "id" | "status" | "createdAt" | "updatedAt" | "editorialNote" | "resolvedBy" | "resolvedAt">,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(reviewRequests).values({
    ...data,
    status: "submitted",
  })) as unknown as [{ insertId: number }];
  return insertId;
}

export async function getReviewRequestById(id: number): Promise<ReviewRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(reviewRequests).where(eq(reviewRequests.id, id)).limit(1);
  return r[0] ?? null;
}

export async function listReviewRequestsByUser(userId: number): Promise<ReviewRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.requestorUserId, userId))
    .orderBy(desc(reviewRequests.createdAt));
}

export async function listReviewRequests(filters: {
  status?: string;
  requestType?: string;
  targetType?: string;
}): Promise<ReviewRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [];
  if (filters.status) conds.push(eq(reviewRequests.status, filters.status as any));
  if (filters.requestType) conds.push(eq(reviewRequests.requestType, filters.requestType as any));
  if (filters.targetType) conds.push(eq(reviewRequests.targetType, filters.targetType as any));
  let q: any = db.select().from(reviewRequests);
  if (conds.length === 1) q = q.where(conds[0]);
  else if (conds.length > 1) q = q.where(and(...conds));
  return q.orderBy(desc(reviewRequests.createdAt));
}

export async function updateReviewRequest(
  id: number,
  patch: Partial<InsertReviewRequest>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviewRequests).set(patch).where(eq(reviewRequests.id, id));
}

/* ================= Story: owner list + soft/hard delete (v3.8) ================= */

export async function listStoriesByOwner(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(stories)
    .where(eq(stories.ownerUserId, userId))
    .orderBy(desc(stories.createdAt));
}

export async function softDeleteStory(id: number, deletedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(stories)
    .set({ deletedAt: new Date(), deletedBy, publicPermission: false })
    .where(eq(stories.id, id));
}

export async function hardDeleteStory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(stories).where(eq(stories.id, id));
}

/* ================= Document: owner list + soft/hard delete (v3.8) ================= */

export async function listDocumentsByOwner(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(eq(documents.uploadedBy, userId))
    .orderBy(desc(documents.createdAt));
}

export async function softDeleteDocument(id: number, deletedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(documents)
    .set({ deletedAt: new Date(), deletedBy, publicStatus: false, visibility: "private_admin_only" })
    .where(eq(documents.id, id));
}

export async function hardDeleteDocument(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(eq(documents.id, id));
}

/* ================= Alias for updatePrr casing compatibility ================= */
export async function updatePrr(id: number, patch: Partial<InsertPublicRecordsRequest>): Promise<void> {
  return updatePRR(id, patch);
}

/* ================= Agencies (v4.0) ================= */
export async function listAgencies(opts?: { publicOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(agencies)
    .where(opts?.publicOnly ? eq(agencies.publicStatus, true) : undefined)
    .orderBy(asc(agencies.agencyType), asc(agencies.name));
  return rows;
}

export async function getAgencyBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agencies).where(eq(agencies.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getAgencyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createAgency(data: InsertAgency) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agencies).values(data);
}

export async function updateAgency(id: number, data: Partial<InsertAgency>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(agencies).set(data).where(eq(agencies.id, id));
}

/* ================= Violation Tags (v4.0) ================= */
export async function listViolationTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(violationTags).orderBy(asc(violationTags.category), asc(violationTags.label));
}

export async function getViolationTagBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(violationTags).where(eq(violationTags.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function createViolationTag(data: InsertViolationTag) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(violationTags).values(data);
}

/* ================= Document Violation Tags (v4.0) ================= */
export async function getDocumentViolationTags(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: documentViolationTags.id,
      documentId: documentViolationTags.documentId,
      violationTagId: documentViolationTags.violationTagId,
      sourceQuote: documentViolationTags.sourceQuote,
      sourceCitation: documentViolationTags.sourceCitation,
      confidence: documentViolationTags.confidence,
      addedBy: documentViolationTags.addedBy,
      createdAt: documentViolationTags.createdAt,
      tagSlug: violationTags.slug,
      tagLabel: violationTags.label,
      tagCategory: violationTags.category,
    })
    .from(documentViolationTags)
    .innerJoin(violationTags, eq(documentViolationTags.violationTagId, violationTags.id))
    .where(eq(documentViolationTags.documentId, documentId))
    .orderBy(asc(violationTags.category));
}

export async function addDocumentViolationTag(data: InsertDocumentViolationTag) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(documentViolationTags).values(data).$returningId();
  return result;
}

export async function removeDocumentViolationTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(documentViolationTags).where(eq(documentViolationTags.id, id));
}

/* ================= Actor Agency Roles (v4.0) ================= */
export async function getActorAgencyRoles(actorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: actorAgencyRoles.id,
      actorId: actorAgencyRoles.actorId,
      agencyId: actorAgencyRoles.agencyId,
      title: actorAgencyRoles.title,
      startDate: actorAgencyRoles.startDate,
      endDate: actorAgencyRoles.endDate,
      isCurrent: actorAgencyRoles.isCurrent,
      notes: actorAgencyRoles.notes,
      agencyName: agencies.name,
      agencySlug: agencies.slug,
      agencyType: agencies.agencyType,
    })
    .from(actorAgencyRoles)
    .innerJoin(agencies, eq(actorAgencyRoles.agencyId, agencies.id))
    .where(eq(actorAgencyRoles.actorId, actorId))
    .orderBy(desc(actorAgencyRoles.isCurrent), desc(actorAgencyRoles.startDate));
}

export async function getAgencyActors(agencyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: actorAgencyRoles.id,
      actorId: actorAgencyRoles.actorId,
      title: actorAgencyRoles.title,
      isCurrent: actorAgencyRoles.isCurrent,
      startDate: actorAgencyRoles.startDate,
      endDate: actorAgencyRoles.endDate,
      actorName: actors.name,
      actorSlug: actors.slug,
      actorRole: actors.role,
    })
    .from(actorAgencyRoles)
    .innerJoin(actors, eq(actorAgencyRoles.actorId, actors.id))
    .where(eq(actorAgencyRoles.agencyId, agencyId))
    .orderBy(desc(actorAgencyRoles.isCurrent), asc(actors.name));
}

export async function addActorAgencyRole(data: InsertActorAgencyRole) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(actorAgencyRoles).values(data);
}

/* ================= Actor Document Links (v4.0) ================= */
export async function getActorDocumentLinks(actorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: actorDocumentLinks.id,
      documentId: actorDocumentLinks.documentId,
      role: actorDocumentLinks.role,
      confidence: actorDocumentLinks.confidence,
      extractedFrom: actorDocumentLinks.extractedFrom,
      addedBy: actorDocumentLinks.addedBy,
      docTitle: documents.title,
      docDate: documents.documentDate,
      docPublicStatus: documents.publicStatus,
    })
    .from(actorDocumentLinks)
    .innerJoin(documents, eq(actorDocumentLinks.documentId, documents.id))
    .where(and(eq(actorDocumentLinks.actorId, actorId), eq(documents.publicStatus, true)))
    .orderBy(desc(documents.documentDate));
}

export async function getDocumentActorLinks(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: actorDocumentLinks.id,
      actorId: actorDocumentLinks.actorId,
      role: actorDocumentLinks.role,
      confidence: actorDocumentLinks.confidence,
      actorName: actors.name,
      actorSlug: actors.slug,
      actorRole: actors.role,
    })
    .from(actorDocumentLinks)
    .innerJoin(actors, eq(actorDocumentLinks.actorId, actors.id))
    .where(eq(actorDocumentLinks.documentId, documentId))
    .orderBy(asc(actors.name));
}

export async function addActorDocumentLink(data: InsertActorDocumentLink) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(actorDocumentLinks).values(data);
}

export async function removeActorDocumentLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(actorDocumentLinks).where(eq(actorDocumentLinks.id, id));
}

/* ================= Actor Timeline Links (v4.0) ================= */
export async function addActorTimelineLink(data: InsertActorTimelineLink) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(actorTimelineLinks).values(data);
}

export async function getActorTimelineLinks(actorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: actorTimelineLinks.id,
      timelineEventId: actorTimelineLinks.timelineEventId,
      role: actorTimelineLinks.role,
      eventTitle: timelineEvents.title,
      eventDate: timelineEvents.eventDate,
      eventCategory: timelineEvents.category,
    })
    .from(actorTimelineLinks)
    .innerJoin(timelineEvents, eq(actorTimelineLinks.timelineEventId, timelineEvents.id))
    .where(eq(actorTimelineLinks.actorId, actorId))
    .orderBy(desc(timelineEvents.eventDate));
}

/* ================= Agency Document Count (v4.0) ================= */
export async function getAgencyDocumentCount(agencyId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Count documents linked to actors who have roles at this agency
  const rows = await db
    .select({ cnt: count() })
    .from(actorDocumentLinks)
    .innerJoin(actorAgencyRoles, eq(actorDocumentLinks.actorId, actorAgencyRoles.actorId))
    .innerJoin(documents, eq(actorDocumentLinks.documentId, documents.id))
    .where(and(eq(actorAgencyRoles.agencyId, agencyId), eq(documents.publicStatus, true)));
  return rows[0]?.cnt ?? 0;
}

/* =============== Site Stats (live dashboard counts) =============== */
export async function getSiteStats() {
  const ARREST_DATE = new Date('2023-03-12T00:00:00Z');
  const empty = { documents: 0, actors: 0, timelineEvents: 0, prrs: 0, daysSinceArrest: 0, arrestDate: '2023-03-12' };
  const db = await getDb();
  if (!db) return empty;
  const [docRows, actorRows, eventRows, prrRows] = await Promise.all([
    db.select({ cnt: count() }).from(documents).where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, 'approved'))),
    db.select({ cnt: count() }).from(actors),
    db.select({ cnt: count() }).from(timelineEvents),
    db.select({ cnt: count() }).from(publicRecordsRequests),
  ]);
  const daysSinceArrest = Math.floor((Date.now() - ARREST_DATE.getTime()) / (1000 * 60 * 60 * 24));
  return {
    documents: docRows[0]?.cnt ?? 0,
    actors: actorRows[0]?.cnt ?? 0,
    timelineEvents: eventRows[0]?.cnt ?? 0,
    prrs: prrRows[0]?.cnt ?? 0,
    daysSinceArrest,
    arrestDate: '2023-03-12',
  };
}

/* =============== Violation Tag Detail (public — for clickable tag pages) =============== */
export async function getViolationTagDetail(slug: string) {
  const db = await getDb();
  if (!db) return null;

  // 1. Fetch the tag itself
  const tagRows = await db
    .select()
    .from(violationTags)
    .where(eq(violationTags.slug, slug))
    .limit(1);
  const tag = tagRows[0] ?? null;
  if (!tag) return null;

  // 2. Fetch all public+approved documents tagged with this violation,
  //    joining through document_violation_tags to get the source quote per document.
  //    A document may have multiple quotes for the same tag; we return all of them.
  const rows = await db
    .select({
      dvtId: documentViolationTags.id,
      sourceQuote: documentViolationTags.sourceQuote,
      sourceCitation: documentViolationTags.sourceCitation,
      confidence: documentViolationTags.confidence,
      addedBy: documentViolationTags.addedBy,
      docId: documents.id,
      docTitle: documents.title,
      docSourceType: documents.sourceType,
      docCaseNumber: documents.caseNumber,
      docDate: documents.documentDate,
      docFileUrl: documents.fileUrl,
    })
    .from(documentViolationTags)
    .innerJoin(violationTags, eq(documentViolationTags.violationTagId, violationTags.id))
    .innerJoin(documents, eq(documentViolationTags.documentId, documents.id))
    .where(
      and(
        eq(violationTags.slug, slug),
        eq(documents.publicStatus, true),
        eq(documents.reviewStatus, "approved"),
      ),
    )
    .orderBy(asc(documents.documentDate), asc(documentViolationTags.id));

  return { tag, entries: rows };
}

/* ================= Judicial Pattern Analysis (v6.0) ================= */

export async function insertJudicialCase(input: InsertJudicialCase) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(judicialCases).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}

export async function listJudicialCases(opts: {
  judge?: string;
  proSe?: boolean;
  ingestStatus?: string;
  publicOnly?: boolean;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters: any[] = [];
  if (opts.judge) filters.push(eq(judicialCases.judgeName, opts.judge));
  if (opts.proSe !== undefined) filters.push(eq(judicialCases.proSeFlag, opts.proSe));
  if (opts.ingestStatus) filters.push(eq(judicialCases.ingestStatus, opts.ingestStatus as any));
  if (opts.publicOnly) filters.push(eq(judicialCases.publicStatus, true));
  let q: any = db.select().from(judicialCases);
  if (filters.length === 1) q = q.where(filters[0]);
  else if (filters.length > 1) q = q.where(and(...filters));
  return q.orderBy(desc(judicialCases.filingDate)).limit(opts.limit ?? 500);
}

export async function getJudicialCaseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(judicialCases).where(eq(judicialCases.id, id)).limit(1);
  return r[0] ?? null;
}

export async function updateJudicialCase(id: number, patch: Partial<InsertJudicialCase>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(judicialCases).set(patch).where(eq(judicialCases.id, id));
}

export async function getJudicialPatternMetrics(judge?: string) {
  const db = await getDb();
  if (!db) return null;
  const baseFilter = judge
    ? and(eq(judicialCases.publicStatus, true), eq(judicialCases.judgeName, judge))
    : eq(judicialCases.publicStatus, true);

  const [agg] = await db
    .select({
      totalCases: sql<number>`COUNT(*)`,
      proSeCases: sql<number>`SUM(CASE WHEN ${judicialCases.proSeFlag} = 1 THEN 1 ELSE 0 END)`,
      representedCases: sql<number>`SUM(CASE WHEN ${judicialCases.representedFlag} = 1 THEN 1 ELSE 0 END)`,
      avgBoilerplateScore: sql<number>`AVG(${judicialCases.boilerplateScore})`,
      maxBoilerplateScore: sql<number>`MAX(${judicialCases.boilerplateScore})`,
      avgTimeToRulingMinutes: sql<number>`AVG(${judicialCases.timeToRulingMinutes})`,
      minTimeToRulingMinutes: sql<number>`MIN(${judicialCases.timeToRulingMinutes})`,
      convictions: sql<number>`SUM(CASE WHEN ${judicialCases.dispositionType} = 'convicted' THEN 1 ELSE 0 END)`,
      dismissals: sql<number>`SUM(CASE WHEN ${judicialCases.dispositionType} LIKE 'dismissed%' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${judicialCases.dispositionType} = 'pending' THEN 1 ELSE 0 END)`,
      // Pro se outcome breakdown
      proSeConvictions: sql<number>`SUM(CASE WHEN ${judicialCases.proSeFlag} = 1 AND ${judicialCases.dispositionType} = 'convicted' THEN 1 ELSE 0 END)`,
      proSeDismissals: sql<number>`SUM(CASE WHEN ${judicialCases.proSeFlag} = 1 AND ${judicialCases.dispositionType} LIKE 'dismissed%' THEN 1 ELSE 0 END)`,
      representedConvictions: sql<number>`SUM(CASE WHEN ${judicialCases.representedFlag} = 1 AND ${judicialCases.dispositionType} = 'convicted' THEN 1 ELSE 0 END)`,
      representedDismissals: sql<number>`SUM(CASE WHEN ${judicialCases.representedFlag} = 1 AND ${judicialCases.dispositionType} LIKE 'dismissed%' THEN 1 ELSE 0 END)`,
    })
    .from(judicialCases)
    .where(baseFilter);

  const boilerplateStats = await db
    .select({
      flaggedCount: sql<number>`COUNT(*)`,
      topPhrase: sql<string>`MAX(${boilerplatePhrases.phrase})`,
    })
    .from(boilerplatePhrases)
    .where(
      and(
        eq(boilerplatePhrases.flagged, true),
        judge ? eq(boilerplatePhrases.judgeName, judge) : sql`1=1`,
      ),
    );

  return { ...(agg as any), boilerplateStats: boilerplateStats[0] };
}

/* ================= Boilerplate Phrases ================= */

export async function upsertBoilerplatePhrase(input: InsertBoilerplatePhrase & { caseId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { caseId, ...rest } = input;
  // Check if phrase hash already exists
  const existing = await db
    .select()
    .from(boilerplatePhrases)
    .where(eq(boilerplatePhrases.phraseHash, input.phraseHash!))
    .limit(1);

  if (existing.length > 0) {
    const prev = existing[0];
    const prevCaseIds: number[] = (prev.caseIds as number[]) ?? [];
    const newCaseIds = prevCaseIds.includes(caseId) ? prevCaseIds : [...prevCaseIds, caseId];
    await db
      .update(boilerplatePhrases)
      .set({
        occurrenceCount: newCaseIds.length,
        caseIds: newCaseIds,
        lastSeen: new Date(),
        // Auto-flag when 5+ cases
        flagged: newCaseIds.length >= 5 ? true : prev.flagged,
      })
      .where(eq(boilerplatePhrases.id, prev.id));
    return prev.id;
  } else {
    const [{ insertId }] = (await db
      .insert(boilerplatePhrases)
      .values({ ...rest, caseIds: [caseId], occurrenceCount: 1, firstSeen: new Date(), lastSeen: new Date() })) as unknown as [
      { insertId: number },
    ];
    return insertId;
  }
}

export async function listBoilerplatePhrases(opts: {
  judge?: string;
  flaggedOnly?: boolean;
  minOccurrences?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters: any[] = [];
  if (opts.judge) filters.push(eq(boilerplatePhrases.judgeName, opts.judge));
  if (opts.flaggedOnly) filters.push(eq(boilerplatePhrases.flagged, true));
  if (opts.minOccurrences) filters.push(sql`${boilerplatePhrases.occurrenceCount} >= ${opts.minOccurrences}`);
  let q: any = db.select().from(boilerplatePhrases);
  if (filters.length === 1) q = q.where(filters[0]);
  else if (filters.length > 1) q = q.where(and(...filters));
  return q.orderBy(desc(boilerplatePhrases.occurrenceCount)).limit(opts.limit ?? 100);
}

/* ================= Leaderboard ================= */
export async function getAuditorLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  // Top contributors by total XP
  return db
    .select({
      userId: contributorXp.userId,
      totalXp: sql<number>`SUM(${contributorXp.points})`,
      actionCount: sql<number>`COUNT(*)`,
    })
    .from(contributorXp)
    .groupBy(contributorXp.userId)
    .orderBy(desc(sql`SUM(${contributorXp.points})`))
    .limit(limit);
}

export async function getActorViolationLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  // Actors ranked by (document count × violation tag count) — violation density
  return db
    .select({
      actorId: actors.id,
      actorName: actors.name,
      actorSlug: actors.slug,
      actorRole: actors.role,
      docCount: sql<number>`COUNT(DISTINCT ${actorDocumentLinks.documentId})`,
      tagCount: sql<number>`COUNT(DISTINCT ${documentViolationTags.id})`,
      heatScore: sql<number>`COUNT(DISTINCT ${actorDocumentLinks.documentId}) * COUNT(DISTINCT ${documentViolationTags.id})`,
    })
    .from(actors)
    .leftJoin(actorDocumentLinks, eq(actorDocumentLinks.actorId, actors.id))
    .leftJoin(documentViolationTags, eq(documentViolationTags.documentId, actorDocumentLinks.documentId))
    .where(eq(actors.publicStatus, true))
    .groupBy(actors.id, actors.name, actors.slug, actors.role)
    .orderBy(desc(sql`COUNT(DISTINCT ${actorDocumentLinks.documentId}) * COUNT(DISTINCT ${documentViolationTags.id})`))
    .limit(limit);
}

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      badgeSlug: contributorBadges.badgeSlug,
      earnedAt: contributorBadges.earnedAt,
      label: badgeDefinitions.label,
      description: badgeDefinitions.description,
      icon: badgeDefinitions.icon,
      category: badgeDefinitions.category,
    })
    .from(contributorBadges)
    .leftJoin(badgeDefinitions, eq(badgeDefinitions.slug, contributorBadges.badgeSlug))
    .where(eq(contributorBadges.userId, userId))
    .orderBy(desc(contributorBadges.earnedAt));
}

export async function getUserXpTotal(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: sql<number>`SUM(${contributorXp.points})` })
    .from(contributorXp)
    .where(eq(contributorXp.userId, userId));
  return row?.total ?? 0;
}


/* ================= v7.0 Artificially Educated — Operator Platform ================= */

export async function getOperatorProfile() {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(operatorProfile).where(eq(operatorProfile.id, 1)).limit(1);
  return r[0] ?? null;
}

export async function upsertOperatorProfile(patch: Partial<InsertOperatorProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(operatorProfile).where(eq(operatorProfile.id, 1)).limit(1);
  if (existing[0]) {
    await db.update(operatorProfile).set(patch).where(eq(operatorProfile.id, 1));
  } else {
    await db.insert(operatorProfile).values({ ...patch, id: 1 } as InsertOperatorProfile);
  }
  const r = await db.select().from(operatorProfile).where(eq(operatorProfile.id, 1)).limit(1);
  return r[0] ?? null;
}

export async function listBuildLog(opts?: { includeHidden?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(buildLogEntries);
  const rows = opts?.includeHidden
    ? await q.orderBy(asc(buildLogEntries.sortOrder), desc(buildLogEntries.createdAt))
    : await q.where(eq(buildLogEntries.publicStatus, true)).orderBy(asc(buildLogEntries.sortOrder), desc(buildLogEntries.createdAt));
  return rows;
}

export async function insertBuildLogEntry(input: InsertBuildLogEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(buildLogEntries).values(input)) as unknown as [{ insertId: number }];
  return insertId;
}

export async function updateBuildLogEntry(id: number, patch: Partial<InsertBuildLogEntry>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(buildLogEntries).set(patch).where(eq(buildLogEntries.id, id));
}

export async function deleteBuildLogEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(buildLogEntries).where(eq(buildLogEntries.id, id));
}

export async function listProjects(opts?: { includeHidden?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(projects);
  const rows = opts?.includeHidden
    ? await q.orderBy(desc(projects.featured), asc(projects.sortOrder), desc(projects.createdAt))
    : await q.where(eq(projects.publicStatus, true)).orderBy(desc(projects.featured), asc(projects.sortOrder), desc(projects.createdAt));
  return rows;
}

export async function getProjectBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return r[0] ?? null;
}

export async function insertProject(input: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(projects).values(input)) as unknown as [{ insertId: number }];
  return insertId;
}

export async function updateProject(id: number, patch: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(patch).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projects).where(eq(projects.id, id));
}

/* ================= v7.1 Filing packages ================= */
export async function insertFilingPackage(input: InsertFilingPackage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ insertId }] = (await db.insert(filingPackages).values(input)) as unknown as [
    { insertId: number },
  ];
  return insertId;
}

export async function updateFilingPackage(id: number, patch: Partial<InsertFilingPackage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(filingPackages).set(patch).where(eq(filingPackages.id, id));
}

export async function deleteFilingPackage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Detach member documents first so they aren't orphaned to a dead FK.
  await db.update(documents).set({ filingPackageId: null }).where(eq(documents.filingPackageId, id));
  await db.delete(filingPackages).where(eq(filingPackages.id, id));
}

export async function getFilingPackageById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(filingPackages).where(eq(filingPackages.id, id)).limit(1);
  return r[0] ?? null;
}

export async function listFilingPackages(opts?: { recordStatus?: string }) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(filingPackages);
  const rows = opts?.recordStatus
    ? await q
        .where(eq(filingPackages.recordStatus, opts.recordStatus as any))
        .orderBy(asc(filingPackages.filedDate), asc(filingPackages.sortOrder))
    : await q.orderBy(asc(filingPackages.filedDate), asc(filingPackages.sortOrder));
  return rows;
}

/**
 * Find or create a filing package by docket entry number within a record/case.
 * Goblin uses this to group related documents deterministically without dupes.
 */
export async function findOrCreateFilingPackage(opts: {
  docketEntryNo: string | null;
  title: string;
  recordStatus: string;
  caseNumber: string | null;
  filedDate: Date | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only dedupe when we have a real docket entry number + case to anchor on.
  if (opts.docketEntryNo && opts.caseNumber) {
    const existing = await db
      .select()
      .from(filingPackages)
      .where(
        and(
          eq(filingPackages.docketEntryNo, opts.docketEntryNo),
          eq(filingPackages.caseNumber, opts.caseNumber),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0].id;
  }
  return insertFilingPackage({
    title: opts.title,
    docketEntryNo: opts.docketEntryNo,
    recordStatus: opts.recordStatus as any,
    caseNumber: opts.caseNumber,
    filedDate: opts.filedDate ?? null,
    source: "goblin",
  });
}

/* ================= v7.1 Document version history (immutable) ================= */
/**
 * Capture an immutable snapshot of a document's current state as a new version.
 * Version numbers are monotonic per-document. A saved snapshot is never mutated.
 */
export async function snapshotDocumentVersion(opts: {
  documentId: number;
  changeNote?: string | null;
  changedBy?: number | null;
  changedBySource?: "admin" | "goblin" | "qc" | "system" | "restore";
  restoredFromVersionNo?: number | null;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const doc = await getDocumentById(opts.documentId);
  if (!doc) return null;
  // Next version number = current max + 1 (append-only).
  const [{ maxNo }] = (await db
    .select({ maxNo: sql<number>`COALESCE(MAX(${documentVersions.versionNo}), 0)` })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, opts.documentId))) as unknown as [{ maxNo: number }];
  const versionNo = Number(maxNo) + 1;
  await db.insert(documentVersions).values({
    documentId: opts.documentId,
    versionNo,
    snapshot: doc as unknown as Record<string, unknown>,
    changeNote: opts.changeNote ?? null,
    changedBy: opts.changedBy ?? null,
    changedBySource: opts.changedBySource ?? "system",
    restoredFromVersionNo: opts.restoredFromVersionNo ?? null,
  });
  return versionNo;
}

export async function listDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNo));
}

export async function getDocumentVersion(documentId: number, versionNo: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionNo, versionNo),
      ),
    )
    .limit(1);
  return r[0] ?? null;
}

/**
 * Restore a document to a prior version. This does NOT overwrite history:
 * it first snapshots the current state (so you can undo the restore), then
 * applies the old snapshot's editable fields, then records that the new live
 * state came from a restore. Immutable-version-identity is preserved.
 */
export async function restoreDocumentVersion(opts: {
  documentId: number;
  versionNo: number;
  changedBy?: number | null;
}): Promise<{ restoredTo: number; newCurrentVersion: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const target = await getDocumentVersion(opts.documentId, opts.versionNo);
  if (!target) return null;
  // 1) snapshot current state first (preserve the pre-restore state in history)
  await snapshotDocumentVersion({
    documentId: opts.documentId,
    changeNote: `Auto-snapshot before restoring to v${opts.versionNo}`,
    changedBy: opts.changedBy ?? null,
    changedBySource: "system",
  });
  // 2) apply the old snapshot's editable fields to the live row
  const snap = target.snapshot as Partial<DocumentRow>;
  const editable: Partial<InsertDocument> = {
    title: snap.title,
    description: snap.description,
    sourceType: snap.sourceType,
    caseNumber: snap.caseNumber,
    documentDate: snap.documentDate ?? undefined,
    filingStampDate: snap.filingStampDate ?? undefined,
    dateSource: snap.dateSource,
    dateConfidence: snap.dateConfidence,
    needsDateReview: snap.needsDateReview,
    dateSourceQuote: snap.dateSourceQuote,
    recordStatus: snap.recordStatus,
    recordStatusConfidence: snap.recordStatusConfidence,
    recordStatusSource: snap.recordStatusSource,
    recordStatusReason: snap.recordStatusReason,
    needsClassificationReview: snap.needsClassificationReview,
    filingPackageId: snap.filingPackageId ?? undefined,
    caseTag: snap.caseTag,
    actorNames: snap.actorNames,
    issueTags: snap.issueTags ?? undefined,
    aiSummary: snap.aiSummary,
    aiTags: snap.aiTags ?? undefined,
    editorialNote: snap.editorialNote,
    correctionNote: snap.correctionNote,
  };
  await updateDocument(opts.documentId, editable);
  // 3) record the post-restore state as a new immutable version
  const newCurrentVersion = await snapshotDocumentVersion({
    documentId: opts.documentId,
    changeNote: `Restored to v${opts.versionNo}`,
    changedBy: opts.changedBy ?? null,
    changedBySource: "restore",
    restoredFromVersionNo: opts.versionNo,
  });
  return { restoredTo: opts.versionNo, newCurrentVersion: newCurrentVersion ?? 0 };
}

/* ================= v7.1 Documents needing human review (QC escalations) ================= */
export async function listDocumentsNeedingReview() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(
      and(
        sql`${documents.deletedAt} IS NULL`,
        or(
          eq(documents.needsDateReview, true),
          eq(documents.needsClassificationReview, true),
        ),
      ),
    )
    .orderBy(desc(documents.createdAt));
}

/**
 * v7.1 — list documents for batch classification, keyset-paginated by id.
 * onlyUnclassified=true skips docs already classified (recordStatus set and not 'unclassified').
 */
export async function listDocumentsForClassification(opts: {
  onlyUnclassified: boolean;
  limit: number;
  afterId: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conds = [sql`${documents.deletedAt} IS NULL`, gt(documents.id, opts.afterId)];
  if (opts.onlyUnclassified) {
    conds.push(
      or(
        sql`${documents.recordStatus} IS NULL`,
        eq(documents.recordStatus, "unclassified" as any),
      )!,
    );
  }
  return db
    .select()
    .from(documents)
    .where(and(...conds))
    .orderBy(asc(documents.id))
    .limit(opts.limit);
}
