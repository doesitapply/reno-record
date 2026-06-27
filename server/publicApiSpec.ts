/**
 * OpenAPI 3.0 spec for the Reno Record public API.
 * Served at GET /api/public/openapi.json. This is the bridge Hermes ingests to
 * generate its callable function/tool schemas.
 */
export function buildOpenApiSpec(baseUrl: string) {
  const ApiKeyAuth = { type: "apiKey", in: "header", name: "x-api-key" } as const;

  const documentSchema = {
    type: "object",
    properties: {
      id: { type: "integer" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      fileUrl: { type: "string", description: "Signed storage path for the source file." },
      mimeType: { type: "string" },
      sourceType: { type: "string" },
      caseNumber: { type: "string", nullable: true },
      caseTag: { type: "string", nullable: true, enum: ["state", "federal", null] },
      recordStatus: {
        type: "string",
        nullable: true,
        enum: ["on_record_state", "on_record_federal", "supporting", "not_yet_on_record", null],
      },
      documentDate: { type: "string", format: "date-time", nullable: true },
      filingStampDate: { type: "string", format: "date-time", nullable: true },
      dateSource: { type: "string", nullable: true, enum: ["filing_stamp", "file_metadata", "inferred", "undated", null] },
      needsDateReview: { type: "boolean" },
      actorNames: { type: "string", nullable: true },
      issueTags: { type: "array", items: { type: "string" }, nullable: true },
      publicStatus: { type: "boolean" },
      reviewStatus: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "The Reno Record — Public Archive API",
      version: "1.0.0",
      description:
        "Read the forensic legal case archive (State CR23-0657, Federal 3:24-cv-00579) and submit documents to the Docket Goblin ingest pipeline. " +
        "All reads return only approved, public records. Ingested documents are NOT published automatically unless they clear the verifiability threshold; " +
        "otherwise they queue for human review. Authenticate with an API key (read or ingest scope) via the `x-api-key` header or `Authorization: Bearer <key>`.",
    },
    servers: [{ url: baseUrl }],
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth,
        BearerAuth: { type: "http", scheme: "bearer", description: "API key as a bearer token." },
      },
      schemas: { Document: documentSchema },
    },
    paths: {
      "/stats": {
        get: {
          operationId: "getStats",
          summary: "Archive summary counts",
          description: "Total approved documents, actors, timeline events, public-records requests, and days since arrest.",
          responses: { "200": { description: "Stats object" } },
        },
      },
      "/documents": {
        get: {
          operationId: "listDocuments",
          summary: "List public documents",
          description: "Returns approved, public documents with optional filters.",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Full-text search over title, description, actors, case number." },
            { name: "recordStatus", in: "query", schema: { type: "string", enum: ["on_record_state", "on_record_federal", "supporting", "not_yet_on_record"] } },
            { name: "caseTag", in: "query", schema: { type: "string", enum: ["state", "federal"] } },
            { name: "sourceType", in: "query", schema: { type: "string" } },
            { name: "violationTagSlug", in: "query", schema: { type: "string" }, description: "Filter to documents tagged with this violation slug." },
            { name: "sortBy", in: "query", schema: { type: "string", enum: ["date_desc", "date_asc"], default: "date_desc" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Matching documents",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: { type: "integer" },
                      documents: { type: "array", items: { $ref: "#/components/schemas/Document" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/documents/{id}": {
        get: {
          operationId: "getDocument",
          summary: "Get one document with violation tags and version history",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Document detail" }, "404": { description: "Not found or not public" } },
        },
      },
      "/violations": {
        get: {
          operationId: "listViolations",
          summary: "Violation tag taxonomy with document counts",
          responses: { "200": { description: "Violation tags + per-tag document counts" } },
        },
      },
      "/actors": {
        get: { operationId: "listActors", summary: "List public actors (people/agencies in the record)", responses: { "200": { description: "Actors" } } },
      },
      "/timeline": {
        get: {
          operationId: "listTimeline",
          summary: "Chronological timeline events",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "storyId", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Timeline events" } },
        },
      },
      "/ingest": {
        post: {
          operationId: "ingestDocument",
          summary: "Submit a document to the Docket Goblin pipeline (ingest scope required)",
          description:
            "Uploads a base64-encoded file, runs extraction + AI classification + QC. The document is created as PENDING and is NOT public " +
            "unless it clears the verifiability threshold. Requires an ingest-scoped API key.",
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["filename", "mimeType", "dataBase64"],
                  properties: {
                    filename: { type: "string", description: "Original filename, e.g. motion_to_dismiss.pdf" },
                    mimeType: { type: "string", description: "MIME type, e.g. application/pdf" },
                    dataBase64: { type: "string", description: "Base64-encoded file bytes (max ~50MB)." },
                    storyId: { type: "integer", description: "Optional story to attach to; defaults to the featured case." },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Ingest accepted" },
            "400": { description: "Invalid upload" },
            "403": { description: "Insufficient scope (needs ingest key)" },
            "429": { description: "Rate limited" },
          },
        },
      },
    },
  };
}
