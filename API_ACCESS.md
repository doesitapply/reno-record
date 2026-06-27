# The Reno Record — Public API

A read + ingest REST API over the forensic case archive (State `CR23-0657`, Federal `3:24-cv-00579`). Designed for external agents — Hermes (OpenAPI function-calling), Codex/Claude/Cursor (MCP), or any HTTP client.

Base URL: `https://<your-domain>/api/public`

---

## Auth

Every endpoint except the two discovery manifests requires an API key.

Pass it either way:

```
x-api-key: <key>
Authorization: Bearer <key>
```

Keys are minted in **Admin → API Keys**. The full key is shown **once** at creation — only its SHA-256 hash is stored server-side. Revoke instantly from the same tab.

### Scopes

| Scope    | Grants                                              |
|----------|-----------------------------------------------------|
| `read`   | All `GET` endpoints                                 |
| `ingest` | Everything `read` grants **plus** `POST /ingest`    |

A `read` key calling `POST /ingest` returns `403 insufficient_scope`.

---

## Discovery manifests (no auth)

| URL                          | Purpose                                  |
|------------------------------|------------------------------------------|
| `GET /api/public/openapi.json` | OpenAPI 3.0 spec — point Hermes at this. |
| `GET /api/public/mcp.json`     | MCP tool manifest — for Codex/Claude.    |

Both are generated from live code, so they always match the deployed surface.

---

## Endpoints

| Method | Path                 | Scope  | Description |
|--------|----------------------|--------|-------------|
| GET    | `/stats`             | read   | Archive summary counts (documents, actors, timeline events, PRRs, days since arrest). |
| GET    | `/documents`         | read   | List approved/public documents with filters + pagination. |
| GET    | `/documents/:id`     | read   | One document + violation tags + immutable version history. |
| GET    | `/violations`        | read   | Violation-tag taxonomy with per-tag document counts. |
| GET    | `/actors`            | read   | Public actors (people/agencies in the record). |
| GET    | `/timeline`          | read   | Chronological timeline events. |
| POST   | `/ingest`            | ingest | Submit a document to the Docket Goblin pipeline. |

### `GET /documents` query params

- `q` — full-text search (title, description, actors, case number)
- `recordStatus` — `on_record_state` | `on_record_federal` | `supporting` | `not_yet_on_record`
- `caseTag` — `state` | `federal`
- `sourceType` — source-type filter
- `violationTagSlug` — only docs tagged with this violation slug
- `sortBy` — `date_desc` (default) | `date_asc`
- `limit` — default 50, max 200
- `offset` — pagination offset

---

## Safety guarantees

- **Reads only ever return approved + public records.** `publicStatus=true AND reviewStatus=approved` is enforced in the DB layer, not the route — there is no query param that exposes drafts, pending, or rejected docs.
- **Internal fields are redacted.** `fileKey` (raw S3 key) and `uploadedBy` are stripped from documents *and* from every version snapshot. Source files are reachable only via the signed `fileUrl` (`/manus-storage/...`) path.
- **Ingest never auto-publishes by default.** Submitted documents run the same Goblin pipeline as the admin uploader and land as `reviewStatus=pending`, `publicStatus=false`. They become public only if they clear the verifiability threshold — identical behavior to the in-app uploader. No API caller can force publication.
- **Rate limit:** 30 ingests / 24h per key creator.

---

## Examples

### Read

```bash
KEY="rr_live_xxx"
BASE="https://<your-domain>/api/public"

# Summary counts
curl -H "x-api-key: $KEY" "$BASE/stats"

# Search federal on-record filings, newest first
curl -H "Authorization: Bearer $KEY" \
  "$BASE/documents?caseTag=federal&recordStatus=on_record_federal&sortBy=date_desc&limit=20"

# One document with violation tags + version history
curl -H "x-api-key: $KEY" "$BASE/documents/240018"

# Violation taxonomy with counts
curl -H "x-api-key: $KEY" "$BASE/violations"
```

### Ingest (ingest-scoped key)

`dataBase64` is the raw file bytes, base64-encoded. Max ~50MB.

```bash
B64=$(base64 -w0 motion_to_dismiss.pdf)
curl -X POST "$BASE/ingest" \
  -H "x-api-key: $INGEST_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"motion_to_dismiss.pdf\",\"mimeType\":\"application/pdf\",\"dataBase64\":\"$B64\"}"
```

Request body:

| Field        | Type    | Required | Notes |
|--------------|---------|----------|-------|
| `filename`   | string  | yes      | Original filename, e.g. `motion.pdf`. |
| `mimeType`   | string  | yes      | e.g. `application/pdf`. |
| `dataBase64` | string  | yes      | Base64-encoded file bytes. |
| `storyId`    | integer | no       | Attach to a specific story; defaults to the featured case. |

Response:

```json
{
  "ok": true,
  "jobId": 123,
  "documentId": 456,
  "published": false,
  "reviewStatus": "pending",
  "verifiability": 0.42,
  "message": "Document ingested and queued for review. It is NOT public until approved."
}
```

---

## Error responses

| Status | `error`               | Meaning |
|--------|-----------------------|---------|
| 400    | `bad_request`         | Missing required ingest fields. |
| 400    | `invalid_upload`      | File failed validation (type/size/integrity). |
| 401    | `missing_api_key`     | No key supplied. |
| 401    | `invalid_api_key`     | Key not found or revoked. |
| 403    | `insufficient_scope`  | Read key attempted ingest. |
| 404    | `not_found`           | Document does not exist or is not public. |
| 429    | `rate_limited`        | Too many ingests for this key creator in 24h. |
| 500    | `ingest_failed` / `auth_error` | Server-side failure. |

---

## Integration notes

- **Hermes:** ingest `/openapi.json`. Each `operationId` becomes a callable function. Supply the key as the `x-api-key` security parameter from your orchestration layer.
- **MCP clients:** `/mcp.json` lists HTTP tool descriptors (this is an HTTP-tool manifest, not a stdio MCP server). Each tool maps to one endpoint; the client/orchestrator injects the `x-api-key` header per call.
