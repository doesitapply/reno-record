/**
 * Public REST API for The Reno Record — v8.0 (Agent API)
 *
 * Mounted at /api/public.
 * Discovery manifests:
 *   GET /api/public/openapi.json  → OpenAPI 3 spec
 *   GET /api/public/mcp.json      → MCP tool manifest
 *
 * Auth: API key via `Authorization: Bearer <key>` or `x-api-key: <key>`.
 *
 * Scopes (additive — each scope includes all scopes below it):
 *   read   — all GET endpoints (public data only)
 *   ingest — read + POST /ingest (document ingestion pipeline)
 *   write  — ingest + all write/monitor/admin agent endpoints
 *
 * Security guarantees:
 *   - read endpoints only return publicStatus=true + reviewStatus=approved rows
 *   - write endpoints require explicit write-scoped key
 *   - only sha256 hash of the raw key is ever stored
 *   - internal fields (fileKey, uploadedBy) are stripped from all responses
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import * as db from "./db";
import { validateUpload, decodeBase64Strict, checkRateLimit, writeAudit } from "./_uploadGuard";
import { runGoblinPipeline } from "./_pipeline";
import { buildOpenApiSpec } from "./publicApiSpec";
import { buildMcpManifest } from "./publicApiMcp";
import { analyzePredicates, persistPredicateFindings } from "./predicateAnalysisEngine";
import { predicateFindings } from "../drizzle/schema";
import { eq, sql, desc, asc } from "drizzle-orm";

type ApiKeyRow = NonNullable<Awaited<ReturnType<typeof db.getActiveApiKeyByHash>>>;

interface AuthedRequest extends Request {
  apiKey?: ApiKeyRow;
}

function extractKey(req: Request): string | null {
  const auth = req.header("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.header("x-api-key");
  if (x) return x.trim();
  return null;
}

/** Scope hierarchy: write > ingest > read */
function scopeAllows(keyScope: string, requiredScope: "read" | "ingest" | "write"): boolean {
  if (requiredScope === "read") return true; // all scopes can read
  if (requiredScope === "ingest") return keyScope === "ingest" || keyScope === "write";
  if (requiredScope === "write") return keyScope === "write";
  return false;
}

function apiKeyAuth(requiredScope: "read" | "ingest" | "write") {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const raw = extractKey(req);
      if (!raw) {
        return res.status(401).json({ error: "missing_api_key", message: "Provide an API key via Authorization: Bearer <key> or x-api-key header." });
      }
      const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
      const key = await db.getActiveApiKeyByHash(keyHash);
      if (!key) {
        return res.status(401).json({ error: "invalid_api_key", message: "API key is invalid or revoked." });
      }
      if (!scopeAllows(key.scope, requiredScope)) {
        return res.status(403).json({
          error: "insufficient_scope",
          message: `This endpoint requires a '${requiredScope}' scoped key. Your key has scope '${key.scope}'.`,
        });
      }
      req.apiKey = key;
      void db.touchApiKey(key.id);
      next();
    } catch (e: any) {
      res.status(500).json({ error: "auth_error", message: String(e?.message || e) });
    }
  };
}

const INTERNAL_DOC_FIELDS = ["fileKey", "uploadedBy", "file_key", "uploaded_by"] as const;

function publicDoc(d: any) {
  if (!d) return d;
  const { fileKey, uploadedBy, ...rest } = d;
  return rest;
}

function publicVersion(v: any) {
  if (!v) return v;
  const snap = v.snapshot;
  if (snap && typeof snap === "object") {
    const cleaned = { ...snap };
    for (const f of INTERNAL_DOC_FIELDS) delete (cleaned as any)[f];
    return { ...v, snapshot: cleaned };
  }
  return v;
}

function asInt(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asFloat(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function createPublicApiRouter(): Router {
  const r = Router();

  // ── Discovery manifests (no auth) ──────────────────────────────────────────
  r.get("/openapi.json", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/public`;
    res.json(buildOpenApiSpec(base));
  });
  r.get("/mcp.json", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/public`;
    res.json(buildMcpManifest(base));
  });

  // ── READ endpoints (scope: read) ───────────────────────────────────────────

  /** System health + aggregate stats */
  r.get("/stats", apiKeyAuth("read"), async (_req, res) => {
    res.json(await db.getSiteStats());
  });

  /** List public documents with optional filters */
  r.get("/documents", apiKeyAuth("read"), async (req, res) => {
    const docs = await db.listPublicDocuments({
      q: req.query.q ? String(req.query.q) : undefined,
      sourceType: req.query.sourceType ? String(req.query.sourceType) : undefined,
      caseTag: req.query.caseTag ? String(req.query.caseTag) : undefined,
      recordStatus: req.query.recordStatus ? String(req.query.recordStatus) : undefined,
      violationTagSlug: req.query.violationTagSlug ? String(req.query.violationTagSlug) : undefined,
      sortBy: req.query.sortBy === "date_asc" ? "date_asc" : "date_desc",
      limit: Math.min(asInt(req.query.limit, 50) ?? 50, 200),
      offset: asInt(req.query.offset, 0),
    });
    res.json({ count: docs.length, documents: docs.map(publicDoc) });
  });

  /** Get a single document by ID */
  r.get("/documents/:id", apiKeyAuth("read"), async (req, res) => {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });
    const doc = await db.getDocumentById(id);
    if (!doc || !doc.publicStatus || doc.reviewStatus !== "approved") {
      return res.status(404).json({ error: "not_found" });
    }
    const [violationTags, versions] = await Promise.all([
      db.getDocumentViolationTags(id),
      db.listDocumentVersions(id),
    ]);
    res.json({ ...publicDoc(doc), violationTags, versions: versions.map(publicVersion) });
  });

  /** List violation taxonomy with document counts */
  r.get("/violations", apiKeyAuth("read"), async (_req, res) => {
    const [tags, metrics] = await Promise.all([db.listViolationTags(), db.getPatternMetrics()]);
    const counts: Record<string, { count: number; latestDocTitle: string | null; latestDocDate: string | null }> = {};
    for (const t of (metrics as any).tagCounts ?? []) {
      counts[t.slug] = { count: Number(t.count) || 0, latestDocTitle: t.latestDocTitle ?? null, latestDocDate: t.latestDocDate ?? null };
    }
    res.json({
      count: tags.length,
      violations: tags.map((t: any) => ({
        slug: t.slug,
        label: t.label,
        category: t.category,
        description: t.description,
        documentCount: counts[t.slug]?.count ?? 0,
        latestDocTitle: counts[t.slug]?.latestDocTitle ?? null,
        latestDocDate: counts[t.slug]?.latestDocDate ?? null,
      })),
    });
  });

  /** List all public actors */
  r.get("/actors", apiKeyAuth("read"), async (_req, res) => {
    res.json({ actors: await db.listPublicActors() });
  });

  /** List public timeline events */
  r.get("/timeline", apiKeyAuth("read"), async (req, res) => {
    const events = await db.listPublicTimeline({
      category: req.query.category ? String(req.query.category) : undefined,
      storyId: asInt(req.query.storyId),
    });
    res.json({ count: events.length, events });
  });

  /** Get violation tags for a specific timeline event */
  r.get("/timeline/:id/tags", apiKeyAuth("read"), async (req, res) => {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });
    const tags = await db.getTimelineEventViolationTags(id);
    res.json({ eventId: id, count: tags.length, tags });
  });

  /** Get predicate analysis report (optionally filtered) */
  r.get("/predicate-report", apiKeyAuth("read"), async (req, res) => {
    const storyId = asInt(req.query.storyId, 60001) ?? 60001;
    const drizzleDb = await db.getDb();
    if (!drizzleDb) return res.status(503).json({ error: "db_unavailable" });
    const statusFilter = req.query.status ? String(req.query.status) : undefined;
    const severityFilter = req.query.severity ? String(req.query.severity) : undefined;
    const limit = Math.min(asInt(req.query.limit, 100) ?? 100, 500);
    const offset = asInt(req.query.offset, 0) ?? 0;
    const conditions: any[] = [eq(predicateFindings.storyId, storyId)];
    if (statusFilter) conditions.push(eq(predicateFindings.predicateStatus, statusFilter as any));
    if (severityFilter) conditions.push(eq(predicateFindings.severityCategory, severityFilter as any));
    const rows = await drizzleDb
      .select()
      .from(predicateFindings)
      .where(conditions.length === 1 ? conditions[0] : (await import("drizzle-orm")).and(...conditions))
      .orderBy(desc(predicateFindings.severityScore), asc(predicateFindings.eventDate))
      .limit(limit)
      .offset(offset);
    res.json({ count: rows.length, storyId, findings: rows });
  });

  /** Monitor: ingest queue status */
  r.get("/monitor/queue", apiKeyAuth("read"), async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const jobs = await db.listIngestJobs({ status, limit: asInt(req.query.limit, 50) });
    const pending = jobs.filter((j: any) => j.status === "pending").length;
    const processing = jobs.filter((j: any) => j.status === "processing").length;
    const failed = jobs.filter((j: any) => j.status === "failed").length;
    res.json({ pending, processing, failed, total: jobs.length, jobs });
  });

  /** Monitor: documents needing review */
  r.get("/monitor/review-queue", apiKeyAuth("read"), async (_req, res) => {
    const docs = await db.listDocumentsNeedingReview() as any[];
    res.json({ count: docs.length, documents: docs.map(publicDoc) });
  });

  /** Monitor: event-level violation tag counts (deduplicated) */
  r.get("/monitor/event-tag-counts", apiKeyAuth("read"), async (_req, res) => {
    const counts = await db.getAllEventViolationTagCounts();
    res.json({ count: counts.length, tagCounts: counts });
  });

  // ── INGEST endpoint (scope: ingest) ────────────────────────────────────────

  /** Ingest a document through the Goblin pipeline */
  r.post("/ingest", apiKeyAuth("ingest"), async (req: AuthedRequest, res) => {
    const { filename, mimeType, dataBase64, storyId } = req.body ?? {};
    if (!filename || !mimeType || !dataBase64) {
      return res.status(400).json({ error: "bad_request", message: "filename, mimeType, and dataBase64 are required." });
    }
    let v;
    try {
      const buffer = decodeBase64Strict(String(dataBase64));
      v = validateUpload({ filename: String(filename), mimeType: String(mimeType), buffer });
    } catch (e: any) {
      await writeAudit({
        action: "upload_rejected",
        targetType: "ingest",
        metadata: { filename, mimeType, reason: e?.message ?? String(e), via: "api", apiKeyId: req.apiKey?.id },
      });
      return res.status(400).json({ error: "invalid_upload", message: e?.message ?? String(e) });
    }
    const rateLimitUserId = req.apiKey!.createdBy;
    if (rateLimitUserId != null) {
      try {
        await checkRateLimit({ userId: rateLimitUserId, action: "document_ingested", windowMs: 24 * 60 * 60 * 1000, max: 30 });
      } catch (e: any) {
        return res.status(429).json({ error: "rate_limited", message: e?.message ?? "Too many ingests in the last 24h." });
      }
    }
    try {
      const result = await runGoblinPipeline({
        filename: v.filename,
        storageFilename: v.storageFilename,
        mimeType: v.mime,
        buffer: v.buffer,
        fileSize: v.size,
        storyId: asInt(storyId) ?? null,
        actor: { userId: req.apiKey!.createdBy ?? null, role: "api", source: "api" },
      });
      res.json({
        ok: true,
        jobId: result.jobId,
        documentId: result.documentId,
        published: result.published,
        reviewStatus: result.published ? "approved" : "pending",
        verifiability: result.verifiability,
        message: result.published
          ? "Document ingested and auto-published."
          : "Document ingested and queued for review.",
      });
    } catch (e: any) {
      res.status(500).json({ error: "ingest_failed", message: String(e?.message || e) });
    }
  });

  // ── WRITE endpoints (scope: write) ─────────────────────────────────────────

  /**
   * POST /timeline
   * Create a new timeline event.
   * Body: { eventDate, title, summary, category, actors?, storyId?, publicStatus? }
   */
  r.post("/timeline", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const { eventDate, title, summary, category, actors, storyId, publicStatus } = req.body ?? {};
    if (!eventDate || !title || !summary || !category) {
      return res.status(400).json({ error: "bad_request", message: "eventDate, title, summary, and category are required." });
    }
    const VALID_CATEGORIES = ["arrest", "hearing", "filing", "order", "discovery", "counsel", "competency", "civil", "warrant", "other"];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "bad_category", message: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }
    try {
      const id = await db.insertTimelineEvent({
        eventDate: new Date(eventDate),
        title: String(title),
        summary: String(summary),
        category: String(category) as any,
        actors: actors ?? null,
        storyId: asInt(storyId) ?? 60001,
        publicStatus: publicStatus !== false,
      });
      res.status(201).json({ ok: true, id, message: "Timeline event created." });
    } catch (e: any) {
      res.status(500).json({ error: "create_failed", message: String(e?.message || e) });
    }
  });

  /**
   * PATCH /timeline/:id
   * Update an existing timeline event.
   * Body: any subset of { eventDate, title, summary, category, actors, publicStatus }
   */
  r.patch("/timeline/:id", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });
    const { eventDate, title, summary, category, actors, publicStatus } = req.body ?? {};
    const patch: any = {};
    if (eventDate !== undefined) patch.eventDate = new Date(eventDate);
    if (title !== undefined) patch.title = String(title);
    if (summary !== undefined) patch.summary = String(summary);
    if (category !== undefined) patch.category = String(category);
    if (actors !== undefined) patch.actors = actors;
    if (publicStatus !== undefined) patch.publicStatus = Boolean(publicStatus);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_fields", message: "Provide at least one field to update." });
    }
    try {
      await db.updateTimelineEvent(id, patch);
      res.json({ ok: true, id, updated: Object.keys(patch) });
    } catch (e: any) {
      res.status(500).json({ error: "update_failed", message: String(e?.message || e) });
    }
  });

  /**
   * POST /timeline/:id/tags
   * Apply a violation tag to a timeline event.
   * Body: { violationTagId, sourceQuote?, sourceCitation?, confidence?, addedBy? }
   */
  r.post("/timeline/:id/tags", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const timelineEventId = asInt(req.params.id);
    if (!timelineEventId) return res.status(400).json({ error: "bad_id" });
    const { violationTagId, sourceQuote, sourceCitation, confidence, addedBy } = req.body ?? {};
    if (!violationTagId) {
      return res.status(400).json({ error: "bad_request", message: "violationTagId is required." });
    }
    try {
      await db.addTimelineEventViolationTag({
        timelineEventId,
        violationTagId: Number(violationTagId),
        sourceQuote: sourceQuote ? String(sourceQuote) : "",
        sourceCitation: sourceCitation ? String(sourceCitation) : undefined,
        confidence: asFloat(confidence, 75) ?? 75,
        addedBy: "human" as const,
      });
      res.status(201).json({ ok: true, timelineEventId, violationTagId: Number(violationTagId) });
    } catch (e: any) {
      res.status(500).json({ error: "tag_failed", message: String(e?.message || e) });
    }
  });

  /**
   * DELETE /timeline/:id/tags/:tagId
   * Remove a violation tag from a timeline event.
   */
  r.delete("/timeline/:id/tags/:tagId", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const tagId = asInt(req.params.tagId);
    if (!tagId) return res.status(400).json({ error: "bad_id" });
    try {
      await db.removeTimelineEventViolationTag(tagId);
      res.json({ ok: true, removedTagId: tagId });
    } catch (e: any) {
      res.status(500).json({ error: "remove_failed", message: String(e?.message || e) });
    }
  });

  /**
   * POST /documents/:id/tags
   * Apply a violation tag to a document.
   * Body: { violationTagId, sourceQuote?, sourceCitation?, confidence?, addedBy? }
   */
  r.post("/documents/:id/tags", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const documentId = asInt(req.params.id);
    if (!documentId) return res.status(400).json({ error: "bad_id" });
    const { violationTagId, sourceQuote, sourceCitation, confidence, addedBy } = req.body ?? {};
    if (!violationTagId) {
      return res.status(400).json({ error: "bad_request", message: "violationTagId is required." });
    }
    try {
      await db.addDocumentViolationTag({
        documentId,
        violationTagId: Number(violationTagId),
        sourceQuote: sourceQuote ? String(sourceQuote) : "",
        sourceCitation: sourceCitation ? String(sourceCitation) : undefined,
        confidence: asFloat(confidence, 75) ?? 75,
        addedBy: "human" as const,
      });
      res.status(201).json({ ok: true, documentId, violationTagId: Number(violationTagId) });
    } catch (e: any) {
      res.status(500).json({ error: "tag_failed", message: String(e?.message || e) });
    }
  });

  /**
   * DELETE /documents/:id/tags/:tagId
   * Remove a violation tag from a document.
   */
  r.delete("/documents/:id/tags/:tagId", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const tagId = asInt(req.params.tagId);
    if (!tagId) return res.status(400).json({ error: "bad_id" });
    try {
      await db.removeDocumentViolationTag(tagId);
      res.json({ ok: true, removedTagId: tagId });
    } catch (e: any) {
      res.status(500).json({ error: "remove_failed", message: String(e?.message || e) });
    }
  });

  /**
   * PATCH /documents/:id
   * Update document metadata (title, summary, classification, publicStatus, etc.)
   * Body: any subset of { title, aiSummary, recordStatus, sourceType, publicStatus, reviewStatus, issueTags, actorNames }
   */
  r.patch("/documents/:id", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });
    const { title, aiSummary, recordStatus, sourceType, publicStatus, reviewStatus, issueTags, actorNames } = req.body ?? {};
    const patch: any = {};
    if (title !== undefined) patch.title = String(title);
    if (aiSummary !== undefined) patch.aiSummary = String(aiSummary);
    if (recordStatus !== undefined) patch.recordStatus = String(recordStatus);
    if (sourceType !== undefined) patch.sourceType = String(sourceType);
    if (publicStatus !== undefined) patch.publicStatus = Boolean(publicStatus);
    if (reviewStatus !== undefined) patch.reviewStatus = String(reviewStatus);
    if (issueTags !== undefined) patch.issueTags = Array.isArray(issueTags) ? issueTags : [issueTags];
    if (actorNames !== undefined) patch.actorNames = Array.isArray(actorNames) ? actorNames : [actorNames];
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_fields", message: "Provide at least one field to update." });
    }
    try {
      await db.updateDocument(id, patch);
      res.json({ ok: true, id, updated: Object.keys(patch) });
    } catch (e: any) {
      res.status(500).json({ error: "update_failed", message: String(e?.message || e) });
    }
  });

  /**
   * POST /predicate-report/generate
   * Trigger a full predicate analysis run for a story.
   * Body: { storyId? } — defaults to 60001 (CR23-0657)
   * Long-running: ~2-5 min for 114 events. Returns immediately with a job token.
   */
  r.post("/predicate-report/generate", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const storyId = asInt(req.body?.storyId, 60001) ?? 60001;
    // Fire async — return immediately with status
    const runId = `predicate-${storyId}-${Date.now()}`;
    res.json({
      ok: true,
      runId,
      storyId,
      message: "Predicate analysis started. Poll GET /predicate-report?storyId=<id> for results. Typical duration: 2-5 minutes.",
      pollUrl: `/api/public/predicate-report?storyId=${storyId}`,
    });
    // Run in background
    (async () => {
      try {
        const findings = await analyzePredicates(storyId);
        const drizzleDb = await db.getDb();
        if (!drizzleDb) return;
        const [versionRow] = await drizzleDb
          .select({ maxVersion: sql<number>`COALESCE(MAX(${predicateFindings.reportVersion}), 0)` })
          .from(predicateFindings)
          .where(eq(predicateFindings.storyId, storyId));
        const nextVersion = ((versionRow as any)?.maxVersion ?? 0) + 1;
        await persistPredicateFindings(storyId, findings, nextVersion);
        console.log(`[AgentAPI] Predicate report generated: storyId=${storyId} findings=${findings.length} version=${nextVersion}`);
      } catch (err) {
        console.error(`[AgentAPI] Predicate report failed: storyId=${storyId}`, err);
      }
    })();
  });

  /**
   * POST /monitor/approve-document
   * Approve a pending document (set reviewStatus=approved + publicStatus=true).
   * Body: { documentId }
   */
  r.post("/monitor/approve-document", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const { documentId } = req.body ?? {};
    const id = asInt(documentId);
    if (!id) return res.status(400).json({ error: "bad_request", message: "documentId is required." });
    try {
      await db.updateDocument(id, { reviewStatus: "approved" as any, publicStatus: true });
      res.json({ ok: true, documentId: id, message: "Document approved and published." });
    } catch (e: any) {
      res.status(500).json({ error: "approve_failed", message: String(e?.message || e) });
    }
  });

  /**
   * POST /monitor/reject-document
   * Reject a pending document (set reviewStatus=rejected + publicStatus=false).
   * Body: { documentId, reason? }
   */
  r.post("/monitor/reject-document", apiKeyAuth("write"), async (req: AuthedRequest, res) => {
    const { documentId, reason } = req.body ?? {};
    const id = asInt(documentId);
    if (!id) return res.status(400).json({ error: "bad_request", message: "documentId is required." });
    try {
      await db.updateDocument(id, {
        reviewStatus: "rejected" as any,
        publicStatus: false,
        ...(reason ? { aiSummary: `[REJECTED: ${reason}]` } : {}),
      });
      res.json({ ok: true, documentId: id, message: "Document rejected." });
    } catch (e: any) {
      res.status(500).json({ error: "reject_failed", message: String(e?.message || e) });
    }
  });

  /**
   * GET /search
   * Full-text search across documents, timeline events, and actors.
   * Query: q (required), limit?
   */
  r.get("/search", apiKeyAuth("read"), async (req, res) => {
    const q = req.query.q ? String(req.query.q) : "";
    if (!q || q.length < 2) {
      return res.status(400).json({ error: "bad_request", message: "q must be at least 2 characters." });
    }
    const limit = Math.min(asInt(req.query.limit, 20) ?? 20, 100);
    try {
      const results = await db.globalSearch(q, limit) as any;
      const totalCount = (results.documents?.length ?? 0) + (results.actors?.length ?? 0) + (results.timeline?.length ?? 0) + (results.violations?.length ?? 0);
      res.json({ q, count: totalCount, results });
    } catch (e: any) {
      res.status(500).json({ error: "search_failed", message: String(e?.message || e) });
    }
  });

  return r;
}
