import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { createPublicApiRouter } from "./publicApi";
import { buildOpenApiSpec } from "./publicApiSpec";
import { buildMcpManifest } from "./publicApiMcp";
import * as db from "./db";

// Build a tiny app that mounts only the public router (mirrors server/_core/index.ts).
function makeApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api/public", createPublicApiRouter());
  return app;
}

const RAW_READ = "rr_live_" + crypto.randomBytes(16).toString("hex");
const RAW_INGEST = "rr_ingest_" + crypto.randomBytes(16).toString("hex");
const hash = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

let readId = 0;
let ingestId = 0;
let revokedRaw = "";
let revokedId = 0;

beforeAll(async () => {
  readId = await db.createApiKey({ label: "vitest-read", keyHash: hash(RAW_READ), keyPrefix: RAW_READ.slice(0, 16), scope: "read", createdBy: null });
  ingestId = await db.createApiKey({ label: "vitest-ingest", keyHash: hash(RAW_INGEST), keyPrefix: RAW_INGEST.slice(0, 16), scope: "ingest", createdBy: null });
  revokedRaw = "rr_live_" + crypto.randomBytes(16).toString("hex");
  revokedId = await db.createApiKey({ label: "vitest-revoked", keyHash: hash(revokedRaw), keyPrefix: revokedRaw.slice(0, 16), scope: "read", createdBy: null });
  await db.revokeApiKey(revokedId);
});

afterAll(async () => {
  // Hard-clean the test keys.
  const sql = await import("./db");
  // Use a query through a known helper path: revoke then leave; revoked keys are harmless.
  await sql.revokeApiKey(readId).catch(() => {});
  await sql.revokeApiKey(ingestId).catch(() => {});
});

describe("public API — auth middleware", () => {
  it("rejects requests with no key (401)", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/stats");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_api_key");
  });

  it("rejects an invalid key (401)", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/stats").set("x-api-key", "rr_live_notarealkey");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_api_key");
  });

  it("rejects a revoked key (401)", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/stats").set("x-api-key", revokedRaw);
    expect(res.status).toBe(401);
  });

  it("accepts a valid read key via x-api-key", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/stats").set("x-api-key", RAW_READ);
    expect(res.status).toBe(200);
    expect(typeof res.body.documents).toBe("number");
  });

  it("accepts a valid key via Authorization: Bearer", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/stats").set("Authorization", `Bearer ${RAW_READ}`);
    expect(res.status).toBe(200);
  });
});

describe("public API — scope enforcement", () => {
  it("blocks a read key from POST /ingest (403)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/public/ingest")
      .set("x-api-key", RAW_READ)
      .send({ filename: "x.pdf", mimeType: "application/pdf", dataBase64: "aGVsbG8=" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_scope");
  });

  it("an ingest key passes scope and reaches validation (400 on bad body, not 403)", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/public/ingest").set("x-api-key", RAW_INGEST).send({});
    expect(res.status).toBe(400); // missing required fields, but scope check passed
    expect(res.body.error).toBe("bad_request");
  });
});

describe("public API — read endpoints", () => {
  it("GET /documents returns approved public docs only", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/documents?limit=5").set("x-api-key", RAW_READ);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.documents)).toBe(true);
    for (const d of res.body.documents) {
      expect(d.publicStatus).toBe(true);
      expect(d.reviewStatus).toBe("approved");
      // internal-only fields must be redacted
      expect(d.fileKey).toBeUndefined();
      expect(d.uploadedBy).toBeUndefined();
    }
  });

  it("GET /documents/:id 404s for a non-public/non-existent id", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/documents/99999999").set("x-api-key", RAW_READ);
    expect(res.status).toBe(404);
  });

  it("GET /documents/:id redacts internal fields on the doc AND in version snapshots", async () => {
    const app = makeApp();
    // Grab a real approved/public doc id from the list endpoint.
    const list = await request(app).get("/api/public/documents?limit=1").set("x-api-key", RAW_READ);
    if (!list.body.documents.length) return; // nothing to assert against in an empty DB
    const id = list.body.documents[0].id;
    const res = await request(app).get(`/api/public/documents/${id}`).set("x-api-key", RAW_READ);
    expect(res.status).toBe(200);
    expect(res.body.fileKey).toBeUndefined();
    expect(res.body.uploadedBy).toBeUndefined();
    expect(Array.isArray(res.body.versions)).toBe(true);
    for (const v of res.body.versions) {
      if (v.snapshot && typeof v.snapshot === "object") {
        expect(v.snapshot.fileKey).toBeUndefined();
        expect(v.snapshot.uploadedBy).toBeUndefined();
        expect(v.snapshot.file_key).toBeUndefined();
        expect(v.snapshot.uploaded_by).toBeUndefined();
      }
    }
  });

  it("GET /violations returns the tag taxonomy with counts", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/violations").set("x-api-key", RAW_READ);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.violations)).toBe(true);
    if (res.body.violations.length) {
      expect(res.body.violations[0]).toHaveProperty("slug");
      expect(res.body.violations[0]).toHaveProperty("documentCount");
    }
  });

  it("GET /actors and /timeline respond 200", async () => {
    const app = makeApp();
    const a = await request(app).get("/api/public/actors").set("x-api-key", RAW_READ);
    const t = await request(app).get("/api/public/timeline").set("x-api-key", RAW_READ);
    expect(a.status).toBe(200);
    expect(t.status).toBe(200);
    expect(Array.isArray(a.body.actors)).toBe(true);
    expect(Array.isArray(t.body.events)).toBe(true);
  });
});

describe("public API — discovery manifests (no auth)", () => {
  it("serves OpenAPI 3 spec without auth", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths["/ingest"]).toBeTruthy();
  });

  it("serves MCP manifest without auth", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/public/mcp.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("reno-record");
    expect(Array.isArray(res.body.tools)).toBe(true);
    const names = res.body.tools.map((t: any) => t.name);
    expect(names).toContain("reno_ingest_document");
  });
});

describe("public API — manifest builders are well-formed", () => {
  it("OpenAPI declares apiKey + bearer security schemes", () => {
    const spec = buildOpenApiSpec("https://example.test/api/public") as any;
    expect(spec.components.securitySchemes.ApiKeyAuth.name).toBe("x-api-key");
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });

  it("MCP marks ingest tool with ingest scope and reads with read scope", () => {
    const m = buildMcpManifest("https://example.test/api/public") as any;
    const ingest = m.tools.find((t: any) => t.name === "reno_ingest_document");
    const stats = m.tools.find((t: any) => t.name === "reno_get_stats");
    expect(ingest.scope).toBe("ingest");
    expect(stats.scope).toBe("read");
  });
});
