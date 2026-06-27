/**
 * MCP-style tool manifest for the Reno Record public API.
 * Served at GET /api/public/mcp.json. For MCP-native clients (Codex/Claude/Cursor)
 * that map tools -> HTTP calls. Each tool corresponds to one REST endpoint.
 *
 * Note: this is an HTTP-tool descriptor manifest, not a stdio MCP server. Clients that
 * speak native MCP-over-stdio should wrap these as HTTP tool calls; the auth header
 * (x-api-key) is supplied by the client/orchestration layer.
 */
export function buildMcpManifest(baseUrl: string) {
  const tool = (
    name: string,
    description: string,
    method: "GET" | "POST",
    path: string,
    inputSchema: Record<string, unknown>,
    scope: "read" | "ingest",
  ) => ({
    name,
    description,
    scope,
    http: { method, url: `${baseUrl}${path}` },
    inputSchema: { type: "object", additionalProperties: false, ...inputSchema },
  });

  return {
    schemaVersion: "1.0",
    name: "reno-record",
    displayName: "The Reno Record — Public Archive",
    description:
      "Read the forensic legal case archive (State CR23-0657, Federal 3:24-cv-00579) and submit documents to the Docket Goblin ingest pipeline. " +
      "Reads return only approved/public records. Ingested documents queue for review and are not auto-published unless they clear the verifiability threshold.",
    auth: {
      type: "apiKey",
      header: "x-api-key",
      alt: "Authorization: Bearer <key>",
      scopes: ["read", "ingest"],
      note: "Credentials are supplied by the calling/orchestration layer per request.",
    },
    tools: [
      tool("reno_get_stats", "Get archive summary counts (documents, actors, timeline events, PRRs, days since arrest).", "GET", "/stats", { properties: {} }, "read"),
      tool(
        "reno_list_documents",
        "List approved public documents with optional filters and pagination.",
        "GET",
        "/documents",
        {
          properties: {
            q: { type: "string", description: "Full-text search." },
            recordStatus: { type: "string", enum: ["on_record_state", "on_record_federal", "supporting", "not_yet_on_record"] },
            caseTag: { type: "string", enum: ["state", "federal"] },
            sourceType: { type: "string" },
            violationTagSlug: { type: "string" },
            sortBy: { type: "string", enum: ["date_desc", "date_asc"] },
            limit: { type: "integer", maximum: 200 },
            offset: { type: "integer" },
          },
        },
        "read",
      ),
      tool(
        "reno_get_document",
        "Get one document with its violation tags and immutable version history.",
        "GET",
        "/documents/{id}",
        { properties: { id: { type: "integer", description: "Document id." } }, required: ["id"] },
        "read",
      ),
      tool("reno_list_violations", "Get the violation tag taxonomy with per-tag document counts.", "GET", "/violations", { properties: {} }, "read"),
      tool("reno_list_actors", "List public actors (people and agencies in the record).", "GET", "/actors", { properties: {} }, "read"),
      tool(
        "reno_list_timeline",
        "List chronological timeline events.",
        "GET",
        "/timeline",
        { properties: { category: { type: "string" }, storyId: { type: "integer" } } },
        "read",
      ),
      tool(
        "reno_ingest_document",
        "Submit a base64-encoded document to the Docket Goblin pipeline. Creates a PENDING record (not public unless it clears the verifiability threshold). Requires an ingest-scoped key.",
        "POST",
        "/ingest",
        {
          properties: {
            filename: { type: "string", description: "Original filename." },
            mimeType: { type: "string", description: "MIME type, e.g. application/pdf." },
            dataBase64: { type: "string", description: "Base64-encoded file bytes." },
            storyId: { type: "integer", description: "Optional story id; defaults to the featured case." },
          },
          required: ["filename", "mimeType", "dataBase64"],
        },
        "ingest",
      ),
    ],
  };
}
