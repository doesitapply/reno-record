# The Reno Record — Agent API Reference

**Base URL:** `https://<your-domain>/api/public`  
**Manifests:** `GET /openapi.json` (OpenAPI 3) · `GET /mcp.json` (MCP tool manifest)

---

## Authentication

All endpoints require an API key. Pass it via either header:

```
Authorization: Bearer <key>
x-api-key: <key>
```

API keys are managed in the Admin Hub → Operator panel. Only the SHA-256 hash is stored.

---

## Scopes

| Scope | Access |
|---|---|
| `read` | All GET endpoints. Returns only `publicStatus=true` + `reviewStatus=approved` rows. |
| `ingest` | `read` + `POST /ingest`. Submits documents through the Goblin pipeline. |
| `write` | `ingest` + all write/monitor/admin endpoints. Full agent access. |

Scopes are additive: `write` includes everything `ingest` and `read` can do.

---

## Read Endpoints

### `GET /stats`
Archive summary counts.

**Response:**
```json
{
  "documentCount": 154,
  "actorCount": 17,
  "timelineEventCount": 114,
  "violationTagCount": 15,
  "daysSinceArrest": 1162
}
```

---

### `GET /documents`
List approved public documents.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `q` | string | Full-text search (title, description, actors, case number, extracted text) |
| `recordStatus` | enum | `on_record_state` \| `on_record_federal` \| `supporting` \| `not_yet_on_record` |
| `caseTag` | enum | `state` \| `federal` |
| `sourceType` | string | `motion`, `court_order`, `email`, `transcript`, etc. |
| `violationTagSlug` | string | Filter by violation tag slug, e.g. `brady_discovery_issue` |
| `sortBy` | enum | `date_desc` (default) \| `date_asc` |
| `limit` | integer | Max 200, default 50 |
| `offset` | integer | Pagination offset |

---

### `GET /documents/:id`
Get one document with violation tags and version history.

---

### `GET /violations`
Get the 15-tag violation taxonomy with per-tag document counts.

**Violation tag slugs:**
| Slug | Category | Label |
|---|---|---|
| `brady_discovery_issue` | discovery | Brady / Discovery Issue |
| `nunc_pro_tunc_concern` | procedural | Nunc Pro Tunc Concern |
| `due_process_defect` | constitutional | Due Process Defect |
| `speedy_trial_violation` | constitutional | Speedy Trial Violation |
| `ineffective_assistance` | counsel | Ineffective Assistance of Counsel |
| `judicial_bias` | judicial | Judicial Bias / Partiality |
| `prosecutorial_misconduct` | prosecutorial | Prosecutorial Misconduct |
| `faretta_violation` | constitutional | Faretta Violation |
| `competency_abuse` | procedural | Competency Proceedings Abuse |
| `fraud_on_court` | judicial | Fraud on the Court |
| `structural_error` | constitutional | Structural Error |
| `retaliation` | prosecutorial | Retaliation / Bad Faith |
| `chain_of_custody` | discovery | Chain of Custody Defect |
| `conflict_of_interest` | judicial | Conflict of Interest |
| `warrant_defect` | procedural | Warrant / Arrest Defect |

---

### `GET /actors`
List all public actors with roles and agency ratings.

---

### `GET /timeline`
List chronological timeline events.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `category` | enum | `arrest` \| `hearing` \| `filing` \| `order` \| `discovery` \| `counsel` \| `competency` \| `civil` \| `warrant` \| `other` |
| `storyId` | integer | Defaults to `60001` (CR23-0657) |

**Event shape:**
```json
{
  "id": 150004,
  "eventDate": "2023-08-18T00:00:00.000Z",
  "title": "Amended complaint, preliminary-hearing waiver, and bindover",
  "summary": "Official summary...\n\n[WHAT WAS REALLY HAPPENING]\n\nNarrative analysis...",
  "category": "hearing",
  "actors": "Judge Breslow, DDA Merchant",
  "storyId": 60001,
  "publicStatus": true
}
```

The `[WHAT WAS REALLY HAPPENING]` delimiter separates the official summary from the process-of-elimination narrative analysis.

---

### `GET /timeline/:id/tags`
Get violation tags applied to a specific timeline event.

---

### `GET /predicate-report`
Get predicate analysis findings.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `storyId` | integer | Defaults to `60001` |
| `status` | enum | `located` \| `partial` \| `contradicted` \| `not_located` |
| `severity` | enum | `critical` \| `high` \| `medium` \| `low` |
| `limit` | integer | Max 500, default 100 |
| `offset` | integer | Pagination |

---

### `GET /search`
Full-text search across documents, timeline events, actors, and violation tags simultaneously.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (min 2 chars) — **required** |
| `limit` | integer | Max 100, default 20 |

**Response:**
```json
{
  "q": "Hicks",
  "count": 7,
  "results": {
    "documents": [...],
    "actors": [...],
    "timeline": [...],
    "violations": [...]
  }
}
```

---

### `GET /monitor/queue`
Ingest job queue status.

**Query params:** `status` (enum), `limit` (integer)

---

### `GET /monitor/review-queue`
Documents pending human review (not yet approved or rejected).

---

### `GET /monitor/event-tag-counts`
Deduplicated event-level violation tag counts (1 event = 1 count).

---

## Ingest Endpoints (scope: `ingest`)

### `POST /ingest`
Submit a document through the Docket Goblin pipeline.

**Body:**
```json
{
  "filename": "motion-to-dismiss.pdf",
  "mimeType": "application/pdf",
  "dataBase64": "<base64-encoded bytes>",
  "storyId": 60001
}
```

**Response:**
```json
{
  "ok": true,
  "jobId": 42,
  "documentId": 155,
  "published": false,
  "reviewStatus": "pending",
  "verifiability": 0.62,
  "message": "Document ingested and queued for review."
}
```

**Rate limit:** 30 ingests per 24 hours per API key.

---

## Write Endpoints (scope: `write`)

### `POST /timeline`
Create a new timeline event.

**Body:**
```json
{
  "eventDate": "2026-07-15",
  "title": "Motion for written findings on speedy trial status",
  "summary": "Official summary...\n\n[WHAT WAS REALLY HAPPENING]\n\nNarrative...",
  "category": "filing",
  "actors": "Cameron Church (pro se)",
  "storyId": 60001,
  "publicStatus": true
}
```

---

### `PATCH /timeline/:id`
Update an existing timeline event. Provide only the fields to change.

---

### `POST /timeline/:id/tags`
Apply a violation tag to a timeline event.

**Body:**
```json
{
  "violationTagId": 4,
  "sourceQuote": "Detective Hicks destroyed the phone before defense could examine it.",
  "sourceCitation": "PC Declaration, p. 3, ¶ 7",
  "confidence": 90
}
```

---

### `DELETE /timeline/:id/tags/:tagId`
Remove a violation tag application by its application ID (from `GET /timeline/:id/tags`).

---

### `POST /documents/:id/tags`
Apply a violation tag to a document. Same body shape as timeline tagging.

---

### `DELETE /documents/:id/tags/:tagId`
Remove a violation tag application from a document.

---

### `PATCH /documents/:id`
Update document metadata.

**Body (all fields optional):**
```json
{
  "title": "Updated title",
  "aiSummary": "Updated summary",
  "recordStatus": "on_record_state",
  "sourceType": "motion",
  "publicStatus": true,
  "reviewStatus": "approved",
  "issueTags": ["speedy_trial", "due_process"],
  "actorNames": ["Judge Breslow", "DDA Merchant"]
}
```

---

### `POST /predicate-report/generate`
Trigger a full predicate analysis run. **Long-running (~2-5 min).** Returns immediately.

**Body:**
```json
{ "storyId": 60001 }
```

**Response:**
```json
{
  "ok": true,
  "runId": "predicate-60001-1752624000000",
  "storyId": 60001,
  "message": "Predicate analysis started. Poll GET /predicate-report?storyId=60001 for results.",
  "pollUrl": "/api/public/predicate-report?storyId=60001"
}
```

---

### `POST /monitor/approve-document`
Approve a pending document. Sets `reviewStatus=approved` and `publicStatus=true`. Document becomes publicly visible immediately.

**Body:** `{ "documentId": 155 }`

---

### `POST /monitor/reject-document`
Reject a pending document. Sets `reviewStatus=rejected` and `publicStatus=false`.

**Body:** `{ "documentId": 155, "reason": "Duplicate of ECF 37" }`

---

## Error Responses

All errors follow this shape:
```json
{
  "error": "error_code",
  "message": "Human-readable description."
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `missing_api_key` | 401 | No key provided |
| `invalid_api_key` | 401 | Key not found or revoked |
| `insufficient_scope` | 403 | Key scope too low for this endpoint |
| `bad_request` | 400 | Missing or invalid required fields |
| `bad_id` | 400 | Invalid or missing ID parameter |
| `not_found` | 404 | Resource not found or not public |
| `rate_limited` | 429 | Too many ingests in 24h window |
| `ingest_failed` | 500 | Pipeline error |

---

## MCP Integration

Point your MCP client at:
```
GET https://<your-domain>/api/public/mcp.json
```

The manifest declares all 22 tools with full JSON Schema input definitions. Each tool maps directly to one HTTP endpoint. Supply your API key via the `x-api-key` header in the client/orchestration layer.

For OpenAPI-compatible clients:
```
GET https://<your-domain>/api/public/openapi.json
```
