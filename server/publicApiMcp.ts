/**
 * MCP-style tool manifest for the Reno Record Agent API v8.0.
 * Served at GET /api/public/mcp.json.
 *
 * Three scopes:
 *   read   — all GET endpoints (public data only)
 *   ingest — read + POST /ingest (document ingestion pipeline)
 *   write  — ingest + all write/monitor/admin agent endpoints
 *
 * This is an HTTP-tool descriptor manifest, not a stdio MCP server.
 * Clients that speak native MCP-over-stdio should wrap these as HTTP tool calls.
 * The auth header (x-api-key) is supplied by the calling/orchestration layer.
 */
export function buildMcpManifest(baseUrl: string) {
  const tool = (
    name: string,
    description: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    inputSchema: Record<string, unknown>,
    scope: "read" | "ingest" | "write",
  ) => ({
    name,
    description,
    scope,
    http: { method, url: `${baseUrl}${path}` },
    inputSchema: { type: "object", additionalProperties: false, ...inputSchema },
  });

  return {
    schemaVersion: "2.0",
    name: "reno-record",
    displayName: "The Reno Record — Agent API",
    description:
      "Full programmatic access to The Reno Record forensic legal archive (State CR23-0657 / Federal 3:24-cv-00579). " +
      "Read endpoints return only approved/public records. Write endpoints require a write-scoped key. " +
      "Ingested documents queue for review and are not auto-published unless they clear the verifiability threshold.",
    auth: {
      type: "apiKey",
      header: "x-api-key",
      alt: "Authorization: Bearer <key>",
      scopes: {
        read: "All GET endpoints. Returns only publicStatus=true + reviewStatus=approved rows.",
        ingest: "read + POST /ingest. Submits documents through the Goblin pipeline.",
        write: "ingest + all write/monitor/admin endpoints. Full agent access.",
      },
      note: "Credentials are supplied by the calling/orchestration layer per request.",
    },
    tools: [
      // ── READ ──────────────────────────────────────────────────────────────
      tool(
        "reno_get_stats",
        "Get archive summary counts: total documents, actors, timeline events, PRRs, days since arrest, violation tag counts.",
        "GET", "/stats", { properties: {} }, "read",
      ),
      tool(
        "reno_list_documents",
        "List approved public documents with optional filters and pagination. Supports full-text search, record status filter, case tag filter, violation tag filter.",
        "GET", "/documents",
        {
          properties: {
            q: { type: "string", description: "Full-text search across title, description, actors, case number, and extracted text." },
            recordStatus: { type: "string", enum: ["on_record_state", "on_record_federal", "supporting", "not_yet_on_record"] },
            caseTag: { type: "string", enum: ["state", "federal"] },
            sourceType: { type: "string", description: "e.g. motion, court_order, email, transcript" },
            violationTagSlug: { type: "string", description: "Filter by violation tag slug, e.g. brady_discovery_issue" },
            sortBy: { type: "string", enum: ["date_desc", "date_asc"] },
            limit: { type: "integer", minimum: 1, maximum: 200 },
            offset: { type: "integer", minimum: 0 },
          },
        },
        "read",
      ),
      tool(
        "reno_get_document",
        "Get one document by ID with its violation tags and immutable version history.",
        "GET", "/documents/{id}",
        { properties: { id: { type: "integer", description: "Document id." } }, required: ["id"] },
        "read",
      ),
      tool(
        "reno_list_violations",
        "Get the 15-tag violation taxonomy with per-tag document counts and latest document metadata.",
        "GET", "/violations", { properties: {} }, "read",
      ),
      tool(
        "reno_list_actors",
        "List all public actors (named individuals and agencies in the record) with their roles and agency ratings.",
        "GET", "/actors", { properties: {} }, "read",
      ),
      tool(
        "reno_list_timeline",
        "List chronological timeline events. Each event includes an official summary and a 'What Was Really Happening' narrative layer.",
        "GET", "/timeline",
        {
          properties: {
            category: { type: "string", enum: ["arrest", "hearing", "filing", "order", "discovery", "counsel", "competency", "civil", "warrant", "other"] },
            storyId: { type: "integer", description: "Story ID. Defaults to 60001 (CR23-0657)." },
          },
        },
        "read",
      ),
      tool(
        "reno_get_event_tags",
        "Get all violation tags applied to a specific timeline event.",
        "GET", "/timeline/{id}/tags",
        { properties: { id: { type: "integer", description: "Timeline event id." } }, required: ["id"] },
        "read",
      ),
      tool(
        "reno_get_predicate_report",
        "Get predicate analysis findings. Filter by status (located/partial/contradicted/not_located) and severity (critical/high/medium/low).",
        "GET", "/predicate-report",
        {
          properties: {
            storyId: { type: "integer", description: "Story ID. Defaults to 60001." },
            status: { type: "string", enum: ["located", "partial", "contradicted", "not_located"] },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            limit: { type: "integer", minimum: 1, maximum: 500 },
            offset: { type: "integer", minimum: 0 },
          },
        },
        "read",
      ),
      tool(
        "reno_search",
        "Full-text search across documents, timeline events, actors, and violation tags simultaneously.",
        "GET", "/search",
        {
          properties: {
            q: { type: "string", description: "Search query (min 2 chars)." },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          required: ["q"],
        },
        "read",
      ),
      tool(
        "reno_monitor_queue",
        "Get ingest job queue status: pending, processing, failed counts and job details.",
        "GET", "/monitor/queue",
        {
          properties: {
            status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
            limit: { type: "integer", minimum: 1, maximum: 200 },
          },
        },
        "read",
      ),
      tool(
        "reno_monitor_review_queue",
        "Get documents pending human review (not yet approved or rejected).",
        "GET", "/monitor/review-queue", { properties: {} }, "read",
      ),
      tool(
        "reno_monitor_event_tag_counts",
        "Get deduplicated event-level violation tag counts (1 event = 1 count, not 1 document = N counts).",
        "GET", "/monitor/event-tag-counts", { properties: {} }, "read",
      ),

      // ── INGEST ────────────────────────────────────────────────────────────
      tool(
        "reno_ingest_document",
        "Submit a base64-encoded document to the Docket Goblin pipeline. Creates a PENDING record (not public unless it clears the verifiability threshold). Requires an ingest-scoped key.",
        "POST", "/ingest",
        {
          properties: {
            filename: { type: "string", description: "Original filename including extension." },
            mimeType: { type: "string", description: "MIME type, e.g. application/pdf." },
            dataBase64: { type: "string", description: "Base64-encoded file bytes." },
            storyId: { type: "integer", description: "Optional story id. Defaults to 60001 (CR23-0657)." },
          },
          required: ["filename", "mimeType", "dataBase64"],
        },
        "ingest",
      ),

      // ── WRITE ─────────────────────────────────────────────────────────────
      tool(
        "reno_create_timeline_event",
        "Create a new timeline event. Requires a write-scoped key. eventDate must be ISO 8601.",
        "POST", "/timeline",
        {
          properties: {
            eventDate: { type: "string", description: "ISO 8601 date, e.g. 2026-07-15." },
            title: { type: "string", description: "Short event title." },
            summary: { type: "string", description: "Full event summary. Optionally include '[WHAT WAS REALLY HAPPENING]' delimiter to add narrative layer." },
            category: { type: "string", enum: ["arrest", "hearing", "filing", "order", "discovery", "counsel", "competency", "civil", "warrant", "other"] },
            actors: { type: "string", description: "Comma-separated actor names." },
            storyId: { type: "integer", description: "Defaults to 60001." },
            publicStatus: { type: "boolean", description: "Whether to publish immediately. Defaults to true." },
          },
          required: ["eventDate", "title", "summary", "category"],
        },
        "write",
      ),
      tool(
        "reno_update_timeline_event",
        "Update an existing timeline event. Provide only the fields to change.",
        "PATCH", "/timeline/{id}",
        {
          properties: {
            id: { type: "integer", description: "Timeline event id." },
            eventDate: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            category: { type: "string" },
            actors: { type: "string" },
            publicStatus: { type: "boolean" },
          },
          required: ["id"],
        },
        "write",
      ),
      tool(
        "reno_tag_timeline_event",
        "Apply a violation tag to a timeline event. sourceQuote is required for human-applied tags. Confidence 0–100.",
        "POST", "/timeline/{id}/tags",
        {
          properties: {
            id: { type: "integer", description: "Timeline event id." },
            violationTagId: { type: "integer", description: "Violation tag id from reno_list_violations." },
            sourceQuote: { type: "string", description: "Direct quote from the record supporting this tag." },
            sourceCitation: { type: "string", description: "Citation: document title, page, docket entry, etc." },
            confidence: { type: "number", minimum: 0, maximum: 100, description: "Confidence 0–100. Defaults to 75." },
          },
          required: ["id", "violationTagId"],
        },
        "write",
      ),
      tool(
        "reno_untag_timeline_event",
        "Remove a violation tag application from a timeline event by tag application id.",
        "DELETE", "/timeline/{id}/tags/{tagId}",
        {
          properties: {
            id: { type: "integer", description: "Timeline event id." },
            tagId: { type: "integer", description: "Tag application id (from reno_get_event_tags)." },
          },
          required: ["id", "tagId"],
        },
        "write",
      ),
      tool(
        "reno_tag_document",
        "Apply a violation tag to a document. sourceQuote is required.",
        "POST", "/documents/{id}/tags",
        {
          properties: {
            id: { type: "integer", description: "Document id." },
            violationTagId: { type: "integer", description: "Violation tag id from reno_list_violations." },
            sourceQuote: { type: "string", description: "Direct quote from the document supporting this tag." },
            sourceCitation: { type: "string", description: "Citation: page number, paragraph, exhibit label, etc." },
            confidence: { type: "number", minimum: 0, maximum: 100, description: "Confidence 0–100. Defaults to 75." },
          },
          required: ["id", "violationTagId"],
        },
        "write",
      ),
      tool(
        "reno_untag_document",
        "Remove a violation tag application from a document by tag application id.",
        "DELETE", "/documents/{id}/tags/{tagId}",
        {
          properties: {
            id: { type: "integer", description: "Document id." },
            tagId: { type: "integer", description: "Tag application id." },
          },
          required: ["id", "tagId"],
        },
        "write",
      ),
      tool(
        "reno_update_document",
        "Update document metadata: title, aiSummary, recordStatus, sourceType, publicStatus, reviewStatus, issueTags, actorNames.",
        "PATCH", "/documents/{id}",
        {
          properties: {
            id: { type: "integer", description: "Document id." },
            title: { type: "string" },
            aiSummary: { type: "string" },
            recordStatus: { type: "string", enum: ["on_record_state", "on_record_federal", "supporting", "not_yet_on_record"] },
            sourceType: { type: "string" },
            publicStatus: { type: "boolean" },
            reviewStatus: { type: "string", enum: ["pending", "approved", "rejected"] },
            issueTags: { type: "array", items: { type: "string" } },
            actorNames: { type: "array", items: { type: "string" } },
          },
          required: ["id"],
        },
        "write",
      ),
      tool(
        "reno_generate_predicate_report",
        "Trigger a full predicate analysis run for a story. Long-running (~2-5 min). Returns immediately with a poll URL. Results appear in reno_get_predicate_report.",
        "POST", "/predicate-report/generate",
        {
          properties: {
            storyId: { type: "integer", description: "Story ID. Defaults to 60001 (CR23-0657)." },
          },
        },
        "write",
      ),
      tool(
        "reno_approve_document",
        "Approve a pending document: sets reviewStatus=approved and publicStatus=true. Document becomes publicly visible immediately.",
        "POST", "/monitor/approve-document",
        {
          properties: {
            documentId: { type: "integer", description: "Document id to approve." },
          },
          required: ["documentId"],
        },
        "write",
      ),
      tool(
        "reno_reject_document",
        "Reject a pending document: sets reviewStatus=rejected and publicStatus=false.",
        "POST", "/monitor/reject-document",
        {
          properties: {
            documentId: { type: "integer", description: "Document id to reject." },
            reason: { type: "string", description: "Optional rejection reason (logged in document record)." },
          },
          required: ["documentId"],
        },
        "write",
      ),
    ],
  };
}
