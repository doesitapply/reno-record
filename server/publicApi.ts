/**
 * Public REST API for The Reno Record.
 *
 * Mounted at /api/public. Two manifests describe the same endpoints:
 *   - GET /api/public/openapi.json  → OpenAPI 3 (for Hermes-style function-callers)
 *   - GET /api/public/mcp.json      → MCP tool manifest (for Codex/Claude/MCP clients)
 *
 * Auth: API key via `Authorization: Bearer <key>` or `x-api-key: <key>`.
 * Scopes: read (all GETs) | ingest (adds POST /ingest). Only sha256 hash is stored.
 *
 * Hard guarantees: read endpoints only ever return publicStatus=true + reviewStatus=approved
 * rows (enforced in db helpers). Ingest goes through the same Goblin pipeline as admin —
 * documents land as pending, never auto-published unless they clear the verifiability threshold.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import * as db from "./db";
import { validateUpload, decodeBase64Strict, checkRateLimit, writeAudit } from "./_uploadGuard";
import { runGoblinPipeline } from "./_pipeline";
import { buildOpenApiSpec } from "./publicApiSpec";
import { buildMcpManifest } from "./publicApiMcp";

type ApiKeyRow = NonNullable<Awaited<ReturnType<typeof db.getActiveApiKeyByHash>>>;

// Attach the resolved key to the request object.
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

/** Middleware factory. requiredScope "read" is satisfied by both read and ingest keys. */
function apiKeyAuth(requiredScope: "read" | "ingest") {
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
      // ingest scope implies read; read scope cannot perform ingest.
      if (requiredScope === "ingest" && key.scope !== "ingest") {
        return res.status(403).json({ error: "insufficient_scope", message: "This endpoint requires an ingest-scoped key." });
      }
      req.apiKey = key;
      // best-effort usage bump; never blocks the request
      void db.touchApiKey(key.id);
      next();
    } catch (e: any) {
      res.status(500).json({ error: "auth_error", message: String(e?.message || e) });
    }
  };
}

// Internal-only fields that must never appear in any public API response.
const INTERNAL_DOC_FIELDS = ["fileKey", "uploadedBy", "file_key", "uploaded_by"] as const;

/** Strip internal-only fields from a document row before returning it publicly. */
function publicDoc(d: any) {
  if (!d) return d;
  const { fileKey, uploadedBy, ...rest } = d;
  return rest;
}

/** Redact internal fields from a version snapshot (snapshots are full row copies). */
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

export function createPublicApiRouter(): Router {
  const r = Router();

  // ---- Manifests (no auth — discovery documents) ----
  r.get("/openapi.json", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/public`;
    res.json(buildOpenApiSpec(base));
  });
  r.get("/mcp.json", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/public`;
    res.json(buildMcpManifest(base));
  });

  // ---- Read endpoints (read scope) ----
  r.get("/stats", apiKeyAuth("read"), async (_req, res) => {
    res.json(await db.getSiteStats());
  });

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

  r.get("/documents/:id", apiKeyAuth("read"), async (req, res) => {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });
    const doc = await db.getDocumentById(id);
    // Only expose approved + public documents through the API.
    if (!doc || !doc.publicStatus || doc.reviewStatus !== "approved") {
      return res.status(404).json({ error: "not_found" });
    }
    const [violationTags, versions] = await Promise.all([
      db.getDocumentViolationTags(id),
      db.listDocumentVersions(id),
    ]);
    res.json({ ...publicDoc(doc), violationTags, versions: versions.map(publicVersion) });
  });

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

  r.get("/actors", apiKeyAuth("read"), async (_req, res) => {
    res.json({ actors: await db.listPublicActors() });
  });

  r.get("/timeline", apiKeyAuth("read"), async (req, res) => {
    const events = await db.listPublicTimeline({
      category: req.query.category ? String(req.query.category) : undefined,
      storyId: asInt(req.query.storyId),
    });
    res.json({ count: events.length, events });
  });

  // ---- Ingest endpoint (ingest scope) ----
  r.post("/ingest", apiKeyAuth("ingest"), async (req: AuthedRequest, res) => {
    const { filename, mimeType, dataBase64, storyId } = req.body ?? {};
    if (!filename || !mimeType || !dataBase64) {
      return res.status(400).json({ error: "bad_request", message: "filename, mimeType, and dataBase64 are required." });
    }
    // Validate before doing any work.
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

    // Per-creator rate limit: 30 ingests / 24h. Keyed on the same actorUserId the pipeline
    // writes to the audit log (the key's createdBy), so the count actually matches.
    const rateLimitUserId = req.apiKey!.createdBy;
    if (rateLimitUserId != null) {
      try {
        await checkRateLimit({
          userId: rateLimitUserId,
          action: "document_ingested",
          windowMs: 24 * 60 * 60 * 1000,
          max: 30,
        });
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
          ? "Document ingested and auto-published (cleared verifiability threshold)."
          : "Document ingested and queued for review. It is NOT public until approved.",
      });
    } catch (e: any) {
      res.status(500).json({ error: "ingest_failed", message: String(e?.message || e) });
    }
  });

  return r;
}
