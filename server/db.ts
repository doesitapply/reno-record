import { and, asc, count, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  actors,
  agentTasks,
  auditLog,
  documents,
  InsertActor,
  InsertAgentTask,
  InsertDocument,
  InsertPublicRecordsRequest,
  InsertStory,
  InsertTimelineEvent,
  InsertUser,
  publicRecordsRequests,
  stories,
  timelineEvents,
  users,
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
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
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
  if (!db) return undefined;
  const r = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  return r[0];
}
export async function getStoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);
  return r[0];
}
export async function getFeaturedStory() {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(stories)
    .where(and(eq(stories.featured, true), eq(stories.status, "approved")))
    .limit(1);
  return r[0];
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
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")];
  if (opts.sourceType && opts.sourceType !== "all") {
    filters.push(eq(documents.sourceType, opts.sourceType as any));
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
  return db
    .select()
    .from(documents)
    .where(and(...filters))
    .orderBy(desc(documents.documentDate))
    .limit(opts.limit ?? 200);
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
  if (!db) return undefined;
  const r = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return r[0];
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
  if (!db) return undefined;
  const r = await db.select().from(actors).where(eq(actors.slug, slug)).limit(1);
  return r[0];
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
  return agg as any;
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
  if (!db) return undefined;
  const r = await db.select().from(ingestJobs).where(eq(ingestJobs.id, id)).limit(1);
  return r[0];
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
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
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
