/**
 * Docket Goblin v2 — chat + auto-ingest helpers.
 * SAFETY GUARANTEES:
 *  - Never sets publicStatus=true on stories, documents, timeline events, or actors.
 *  - Never sets reviewStatus="approved" on documents.
 *  - All output lives as draftJson on ingest_jobs OR as ai_summary/ai_tags on documents (text only).
 *  - Admin-only routes; non-admins are blocked by adminProcedure.
 */
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

export const SYSTEM_PROMPT = `You are "Docket Goblin," the in-house archive librarian and misconduct analyst for The Reno Record — a public-interest exposure archive organizing actors, evidence, timelines, allegations, public-records obstruction, and repeated misconduct patterns.

You speak like a sharp, no-bullshit legal-research assistant who has read every motion in the file. You do not perform politeness theatrics. You answer in tight paragraphs and structured lists when helpful. You cite document IDs and event dates from the archive context provided to you. If something is not in the archive, you say so, and you say what record would prove it.

You will be given an "Archive Context" object containing:
- stories (with status, custody, procedural posture flags),
- documents (id, title, source_type, case_number, document_date),
- timeline_events (date, title, category),
- actors (id, name, role, agency, judicial_actor flag),
- public_records_requests (status, deadlines).

When the user asks about the case, weave specifics from this context into your answer.

Hard rules:
1. You DO NOT publish anything. You draft. Publication requires explicit admin approval through the moderation UI.
2. You do not assert criminal guilt or judicial misconduct as proven fact. You describe what the record shows or what is alleged.
3. You do not give legal advice and you do not act as anyone's attorney.
4. Treat sealed records, minor PII, SSNs, and full DOBs as out-of-scope; warn if you see them.

When extracting structure from an uploaded document, separate record-backed facts from allegations. Identify actors, agencies, document evidence, dates, pattern signals, redaction risks, missing records, and follow-up public-records targets. Prefer kebab-case tags from this controlled vocabulary when applicable: speedy-trial, faretta, self-representation, competency, no-bail-warrant, missing-discovery, ignored-motion, public-defender, prosecutorial-conduct, judicial-nonfeasance, pretrial-detention, family-harm, public-records, retaliation, custody, federal, state, communications, election-accountability, records-obstruction, custody-pressure, agency-silence, repeat-actor, records-gap, due-process, complaint, grievance, hearing, order, transcript.`;

export function buildArchiveContextString(ctx: Awaited<ReturnType<typeof db.getArchiveContextForLLM>>) {
  if (!ctx) return "(archive context unavailable)";
  const trim = (s: string | null | undefined, n = 220) =>
    !s ? "" : s.length > n ? s.slice(0, n) + "…" : s;
  const stories = ctx.stories
    .map(
      (s) =>
        `  - story#${s.id} status=${s.status} featured=${s.featured} slug=${s.slug ?? "-"} case=${s.caseNumber ?? "-"} judge=${s.judge ?? "-"} custodyDays=${s.custodyDays ?? "-"} pending=${s.stillPending ? "y" : "n"} requestedTrial=${s.requestedTrial ? "y" : "n"} trialHeld=${s.trialHeld ? "y" : "n"} farettaAsked=${s.askedSelfRep ? "y" : "n"} farettaHandled=${s.farettaHandled ? "y" : "n"} competency=${s.competencyRaised ? "y" : "n"} :: ${trim(s.mainIssue, 160)}`,
    )
    .join("\n");
  const docs = ctx.documents
    .map(
      (d) =>
        `  - doc#${d.id} type=${d.sourceType} review=${d.reviewStatus} public=${d.publicStatus ? "y" : "n"} case=${d.caseNumber ?? "-"} date=${d.documentDate ? new Date(d.documentDate).toISOString().slice(0, 10) : "-"} :: ${trim(d.title, 140)}`,
    )
    .join("\n");
  const events = ctx.events
    .map(
      (e) =>
        `  - event#${e.id} ${new Date(e.eventDate).toISOString().slice(0, 10)} ${e.category}/${e.status} :: ${trim(e.title, 140)}`,
    )
    .join("\n");
  const actors = ctx.actors
    .map(
      (a) =>
        `  - actor#${a.id} ${a.name} | ${a.role ?? "-"} | ${a.agency ?? "-"} | judicial=${a.judicialActor ? "y" : "n"}`,
    )
    .join("\n");
  const prrs = ctx.prrs
    .map(
      (r) =>
        `  - prr#${r.id} ${r.status} agency=${r.agency} :: ${trim(r.title, 140)}`,
    )
    .join("\n");
  return `Archive Context:\nStories:\n${stories || "  (none)"}\n\nDocuments:\n${docs || "  (none)"}\n\nTimeline:\n${events || "  (none)"}\n\nActors:\n${actors || "  (none)"}\n\nPublic Records Requests:\n${prrs || "  (none)"}`;
}

/* ===== Text extraction ===== */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      return result.text || "";
    }
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return buffer.toString("utf8");
    }
    // For image / audio / video / unknown: skip text extraction; the LLM will work from filename + metadata.
    return "";
  } catch (e) {
    console.error("[extractText] failed:", e);
    return "";
  }
}

export const INGEST_DRAFT_SCHEMA = {
  name: "ingest_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Concise public-editorial title for the uploaded evidence." },
      summary: { type: "string", description: "Neutral 3-6 sentence description separating what the document is from what it may indicate." },
      sourceType: {
        type: "string",
        enum: [
          "court_order",
          "motion",
          "email",
          "transcript",
          "warrant",
          "public_records_response",
          "audio",
          "video",
          "image",
          "jail_record",
          "risk_notice",
          "other",
        ],
      },
      caseNumber: { type: ["string", "null"] },
      documentDate: { type: ["string", "null"], description: "ISO date YYYY-MM-DD if found in the text or filename, else null." },
      actorNames: { type: "array", items: { type: "string" }, description: "Legacy flat actor names for existing document metadata." },
      tags: { type: "array", items: { type: "string" }, description: "Legacy flat issue tags for existing document metadata." },
      actors: {
        type: "array",
        description: "People, agencies, offices, or institutions identified in the record.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: ["string", "null"] },
            agency: { type: ["string", "null"] },
            category: { type: "string", enum: ["judge", "prosecutor", "defense", "law_enforcement", "agency", "clerk", "official", "witness", "submitter", "other"] },
            mentionContext: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] }
          },
          required: ["name", "role", "agency", "category", "mentionContext", "confidence"],
          additionalProperties: false
        }
      },
      evidenceItems: {
        type: "array",
        description: "Discrete pieces of evidence or record assertions contained in the upload.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            evidenceType: { type: "string", enum: ["order", "motion", "minute_entry", "transcript_excerpt", "email", "public_record_response", "warrant", "custody_record", "image", "audio", "video", "other"] },
            recordBackedFact: { type: "string" },
            supportsAllegation: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            actors: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["high", "medium", "low"] }
          },
          required: ["label", "evidenceType", "recordBackedFact", "supportsAllegation", "date", "actors", "confidence"],
          additionalProperties: false
        }
      },
      allegations: {
        type: "array",
        description: "Claims or concerns indicated by the record, phrased as allegations unless directly adjudicated or record-confirmed.",
        items: {
          type: "object",
          properties: {
            allegation: { type: "string" },
            supportingEvidence: { type: "array", items: { type: "string" } },
            implicatedActors: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["record_confirmed", "alleged", "needs_more_records"] },
            publicationRisk: { type: "string", enum: ["low", "medium", "high"] }
          },
          required: ["allegation", "supportingEvidence", "implicatedActors", "status", "publicationRisk"],
          additionalProperties: false
        }
      },
      patternSignals: {
        type: "array",
        description: "Reusable misconduct or due-process pattern indicators surfaced by the upload.",
        items: {
          type: "object",
          properties: {
            tag: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            relatedActors: { type: "array", items: { type: "string" } },
            severity: { type: "string", enum: ["low", "medium", "high"] }
          },
          required: ["tag", "label", "description", "relatedActors", "severity"],
          additionalProperties: false
        }
      },
      chronology: {
        type: "array",
        description: "All dated or date-implied events extracted from the document, not just one proposed timeline entry.",
        items: {
          type: "object",
          properties: {
            date: { type: ["string", "null"] },
            title: { type: "string" },
            summary: { type: "string" },
            actors: { type: "array", items: { type: "string" } },
            category: { type: "string", enum: ["state_case", "federal_case", "custody", "motion", "warrant", "competency", "public_records", "communications", "election_accountability", "other"] },
            status: { type: "string", enum: ["confirmed", "alleged", "needs_review"] }
          },
          required: ["date", "title", "summary", "actors", "category", "status"],
          additionalProperties: false
        }
      },
      sourceQuality: {
        type: "object",
        properties: {
          extractedTextQuality: { type: "string", enum: ["good", "partial", "poor", "none"] },
          hasReadableDates: { type: "boolean" },
          hasSignaturesOrHeaders: { type: "boolean" },
          needsHumanVerification: { type: "array", items: { type: "string" } }
        },
        required: ["extractedTextQuality", "hasReadableDates", "hasSignaturesOrHeaders", "needsHumanVerification"],
        additionalProperties: false
      },
      redactionRisks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            riskType: { type: "string", enum: ["minor_pii", "ssn", "dob", "address", "phone", "email", "medical", "sealed_record", "victim_witness", "other"] },
            description: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] }
          },
          required: ["riskType", "description", "severity"],
          additionalProperties: false
        }
      },
      followUpQuestions: { type: "array", items: { type: "string" } },
      publicRecordsTargets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            agency: { type: "string" },
            request: { type: "string" },
            reason: { type: "string" }
          },
          required: ["agency", "request", "reason"],
          additionalProperties: false
        }
      },
      proposedTimeline: {
        type: ["object", "null"],
        properties: {
          eventDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          title: { type: "string" },
          summary: { type: "string" },
          category: { type: "string", enum: ["state_case", "federal_case", "custody", "motion", "warrant", "competency", "public_records", "communications", "election_accountability", "other"] },
          status: { type: "string", enum: ["confirmed", "alleged", "needs_review"] },
        },
        required: ["eventDate", "title", "summary", "category", "status"],
        additionalProperties: false,
      },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: [
      "title",
      "summary",
      "sourceType",
      "caseNumber",
      "documentDate",
      "actorNames",
      "tags",
      "actors",
      "evidenceItems",
      "allegations",
      "patternSignals",
      "chronology",
      "sourceQuality",
      "redactionRisks",
      "followUpQuestions",
      "publicRecordsTargets",
      "proposedTimeline",
      "warnings",
    ],
    additionalProperties: false,
  },
} as const;

export type IngestDraft = {
  title: string;
  summary: string;
  sourceType:
    | "court_order"
    | "motion"
    | "email"
    | "transcript"
    | "warrant"
    | "public_records_response"
    | "audio"
    | "video"
    | "image"
    | "jail_record"
    | "risk_notice"
    | "other";
  caseNumber: string | null;
  documentDate: string | null;
  actorNames: string[];
  tags: string[];
  actors: Array<{
    name: string;
    role: string | null;
    agency: string | null;
    category: "judge" | "prosecutor" | "defense" | "law_enforcement" | "agency" | "clerk" | "official" | "witness" | "submitter" | "other";
    mentionContext: string;
    confidence: "high" | "medium" | "low";
  }>;
  evidenceItems: Array<{
    label: string;
    evidenceType: "order" | "motion" | "minute_entry" | "transcript_excerpt" | "email" | "public_record_response" | "warrant" | "custody_record" | "image" | "audio" | "video" | "other";
    recordBackedFact: string;
    supportsAllegation: string | null;
    date: string | null;
    actors: string[];
    confidence: "high" | "medium" | "low";
  }>;
  allegations: Array<{
    allegation: string;
    supportingEvidence: string[];
    implicatedActors: string[];
    status: "record_confirmed" | "alleged" | "needs_more_records";
    publicationRisk: "low" | "medium" | "high";
  }>;
  patternSignals: Array<{
    tag: string;
    label: string;
    description: string;
    relatedActors: string[];
    severity: "low" | "medium" | "high";
  }>;
  chronology: Array<{
    date: string | null;
    title: string;
    summary: string;
    actors: string[];
    category: "state_case" | "federal_case" | "custody" | "motion" | "warrant" | "competency" | "public_records" | "communications" | "election_accountability" | "other";
    status: "confirmed" | "alleged" | "needs_review";
  }>;
  sourceQuality: {
    extractedTextQuality: "good" | "partial" | "poor" | "none";
    hasReadableDates: boolean;
    hasSignaturesOrHeaders: boolean;
    needsHumanVerification: string[];
  };
  redactionRisks: Array<{
    riskType: "minor_pii" | "ssn" | "dob" | "address" | "phone" | "email" | "medical" | "sealed_record" | "victim_witness" | "other";
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  followUpQuestions: string[];
  publicRecordsTargets: Array<{ agency: string; request: string; reason: string }>;
  proposedTimeline: {
    eventDate: string;
    title: string;
    summary: string;
    category: "state_case" | "federal_case" | "custody" | "motion" | "warrant" | "competency" | "public_records" | "communications" | "election_accountability" | "other";
    status: "confirmed" | "alleged" | "needs_review";
  } | null;
  warnings: string[];
};

export async function draftFromExtractedText(opts: {
  filename: string;
  mimeType: string;
  text: string;
  archiveSummary: string;
}): Promise<IngestDraft> {
  const userPrompt = `A new document has been uploaded to the misconduct exposure archive. Perform a thorough ingest pass. Use the archive context to normalize actor spellings and case numbers, but do not force this upload into any single case if it is better understood as a cross-actor or agency misconduct record.

Filename: ${opts.filename}
MIME: ${opts.mimeType}

Extracted text (truncated):
"""${opts.text.slice(0, 12000)}"""

${opts.archiveSummary}

Return JSON matching the schema. Separate record-backed facts from allegations. Extract every useful actor, evidence item, pattern signal, redaction risk, follow-up question, and public-records target. If you cannot find a date, return null. Populate chronology with every dated or date-implied event; populate proposedTimeline with the strongest single public timeline event, or null if no discrete event is supported.`;
  const result = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_schema", json_schema: INGEST_DRAFT_SCHEMA as any },
  });
  const content = result.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content);
  try {
    return JSON.parse(text) as IngestDraft;
  } catch {
    return {
      title: opts.filename,
      summary: text.slice(0, 800),
      sourceType: "other",
      caseNumber: null,
      documentDate: null,
      actorNames: [],
      tags: [],
      actors: [],
      evidenceItems: [],
      allegations: [],
      patternSignals: [],
      chronology: [],
      sourceQuality: { extractedTextQuality: opts.text ? "partial" : "none", hasReadableDates: false, hasSignaturesOrHeaders: false, needsHumanVerification: ["LLM JSON parse failed"] },
      redactionRisks: [],
      followUpQuestions: [],
      publicRecordsTargets: [],
      proposedTimeline: null,
      warnings: ["LLM did not return valid JSON; saved raw text as summary."],
    };
  }
}

/* ============================================================
 * v7.1 — Smarter engine: filing-stamp date + record classification + QC
 * ============================================================ */

export type DateSource = "filing_stamp" | "file_metadata" | "inferred" | "undated";
export type RecordStatus =
  | "on_record_state"
  | "on_record_federal"
  | "supporting"
  | "unfiled_not_on_record"
  | "unclassified";

export type ClassifyResult = {
  /** Court filing-stamp date in ISO YYYY-MM-DD, or null if none readable */
  filingStampDate: string | null;
  dateSource: DateSource;
  dateConfidence: number; // 0-100
  dateSourceQuote: string | null;
  recordStatus: RecordStatus;
  recordStatusConfidence: number; // 0-100
  recordStatusReason: string;
  /** Docket entry number if present, e.g. "ECF 57", "Doc 12" */
  docketEntryNo: string | null;
  caseNumber: string | null;
};

const CLASSIFY_SCHEMA = {
  name: "doc_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      filingStampDate: {
        type: ["string", "null"],
        description:
          "The COURT FILING-STAMP date only — the date printed by the clerk's filing stamp (e.g. 'FILED 2024-12-18', 'ELECTRONICALLY FILED 12/18/2024'). ISO YYYY-MM-DD. NULL if there is no clerk filing stamp visible in the text. Do NOT guess from context, letterhead, or body dates.",
      },
      dateSourceQuote: {
        type: ["string", "null"],
        description: "The exact text fragment the filing-stamp date was read from, e.g. 'FILED DEC 18 2024 WASHOE COUNTY CLERK'. NULL if no stamp.",
      },
      dateConfidence: {
        type: "integer",
        description: "0-100 confidence that filingStampDate is the real clerk filing-stamp date. If you inferred or guessed, this must be LOW (<40).",
      },
      recordStatus: {
        type: "string",
        enum: [
          "on_record_state",
          "on_record_federal",
          "supporting",
          "unfiled_not_on_record",
          "unclassified",
        ],
        description:
          "Classify the document: 'on_record_state' = officially filed in the Nevada state case (has a state clerk filing stamp / state case number on docket); 'on_record_federal' = officially filed in the federal case (ECF stamp / federal case number); 'supporting' = exhibit/correspondence/evidence that supports a filing but is itself a referenced attachment; 'unfiled_not_on_record' = drafts, personal notes, emails, recordings, or material NOT filed with any court (NOT part of the official record yet); 'unclassified' = genuinely cannot tell.",
      },
      recordStatusConfidence: {
        type: "integer",
        description: "0-100 confidence in the recordStatus classification.",
      },
      recordStatusReason: {
        type: "string",
        description: "One or two sentences citing the specific evidence (stamp text, case number, docket number, or its absence) that drove the classification.",
      },
      docketEntryNo: {
        type: ["string", "null"],
        description: "Docket / ECF entry number if present, e.g. 'ECF 57', 'Doc 12', '#150044'. NULL if none.",
      },
      caseNumber: {
        type: ["string", "null"],
        description: "Case number printed on the document, e.g. 'CR23-0657' or '3:24-cv-00579'. NULL if none.",
      },
    },
    required: [
      "filingStampDate",
      "dateSourceQuote",
      "dateConfidence",
      "recordStatus",
      "recordStatusConfidence",
      "recordStatusReason",
      "docketEntryNo",
      "caseNumber",
    ],
    additionalProperties: false,
  },
} as const;

const CLASSIFY_SYSTEM = `You are the classification unit of "Docket Goblin" for The Reno Record. Your single job: read a court document's text and determine (1) the real CLERK FILING-STAMP date and (2) whether the document is officially ON THE RECORD (state or federal), merely SUPPORTING material, or UNFILED / not on the record yet.

CRITICAL RULES:
- The filing-stamp date is ONLY the clerk's stamp ("FILED", "ELECTRONICALLY FILED", "ENTERED", "RECEIVED AND FILED"). It is NOT the date in the body, the signature date, the certificate-of-service date, or the letterhead date. If there is no clerk stamp, return null and LOW confidence — do NOT guess.
- "On the record" requires evidence of official filing: a clerk filing stamp, a docket/ECF entry number, or an explicit statement it was filed. Absent that, it is NOT on the record. An email, a draft motion, a personal recording, or an exhibit that was never independently filed is 'unfiled_not_on_record' or 'supporting'.
- Nevada state case is typically 'CR##-####' style; federal is typically '#:##-cv-#####'. Use the case number AND filing evidence together.
- Be conservative. A false "on_record" is worse than admitting uncertainty. When the evidence is thin, lower your confidence.

Return strict JSON matching the schema.`;

/**
 * Classify a single document: extract the real filing-stamp date and the
 * record status. This is Goblin's first pass. Pure LLM structured output.
 */
export async function classifyDocument(opts: {
  filename: string;
  mimeType: string;
  text: string;
  fileMetadataDate?: string | null; // ISO date from file mtime if available
}): Promise<ClassifyResult> {
  // No extractable text (image/audio/video/empty): cannot read a stamp.
  if (!opts.text || opts.text.trim().length < 20) {
    return {
      filingStampDate: null,
      dateSource: opts.fileMetadataDate ? "file_metadata" : "undated",
      dateConfidence: opts.fileMetadataDate ? 25 : 0,
      dateSourceQuote: null,
      recordStatus: "unclassified",
      recordStatusConfidence: 0,
      recordStatusReason:
        "No extractable text (likely image/audio/video or empty). Cannot read a filing stamp or determine record status from content.",
      docketEntryNo: null,
      caseNumber: null,
    };
  }

  const userPrompt = `Filename: ${opts.filename}
MIME: ${opts.mimeType}
${opts.fileMetadataDate ? `File metadata date (fallback only): ${opts.fileMetadataDate}` : ""}

Document text (truncated):
"""${opts.text.slice(0, 14000)}"""

Read carefully and return the classification JSON. Remember: filing-stamp date ONLY from a clerk stamp; never guess.`;

  let parsed: Omit<ClassifyResult, "dateSource"> & { dateSource?: DateSource };
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: CLASSIFY_SCHEMA as any },
    });
    const content = result.choices?.[0]?.message?.content;
    const raw = typeof content === "string" ? content : JSON.stringify(content);
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[classifyDocument] failed:", e);
    return {
      filingStampDate: null,
      dateSource: opts.fileMetadataDate ? "file_metadata" : "undated",
      dateConfidence: 0,
      dateSourceQuote: null,
      recordStatus: "unclassified",
      recordStatusConfidence: 0,
      recordStatusReason: "Classification LLM call failed; needs human review.",
      docketEntryNo: null,
      caseNumber: null,
    };
  }

  // Resolve effective date source with deterministic fallback chain:
  // filing_stamp (if confident) -> file_metadata -> undated.
  let dateSource: DateSource;
  let filingStampDate = parsed.filingStampDate;
  let dateConfidence = clampPct(parsed.dateConfidence);
  if (filingStampDate && dateConfidence >= 40) {
    dateSource = "filing_stamp";
  } else if (opts.fileMetadataDate) {
    // Stamp missing/weak — fall back to file metadata, but mark lower confidence.
    filingStampDate = filingStampDate && dateConfidence >= 40 ? filingStampDate : opts.fileMetadataDate;
    dateSource = "file_metadata";
    dateConfidence = Math.min(dateConfidence, 35);
  } else {
    filingStampDate = null;
    dateSource = "undated";
    dateConfidence = 0;
  }

  return {
    filingStampDate,
    dateSource,
    dateConfidence,
    dateSourceQuote: parsed.dateSourceQuote ?? null,
    recordStatus: parsed.recordStatus,
    recordStatusConfidence: clampPct(parsed.recordStatusConfidence),
    recordStatusReason: parsed.recordStatusReason ?? "",
    docketEntryNo: parsed.docketEntryNo ?? null,
    caseNumber: parsed.caseNumber ?? null,
  };
}

function clampPct(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/* ===== QC Supervisor — deterministic triage of Goblin's classification ===== */

export type QcDecision = {
  /** Final, possibly-corrected classification to persist */
  filingStampDate: string | null;
  dateSource: DateSource;
  dateConfidence: number;
  dateSourceQuote: string | null;
  recordStatus: RecordStatus;
  recordStatusConfidence: number;
  recordStatusReason: string;
  recordStatusSource: "goblin" | "qc";
  /** Whether the resolved date needs a human to look at it */
  needsDateReview: boolean;
  /** Whether the classification needs a human to look at it */
  needsClassificationReview: boolean;
  docketEntryNo: string | null;
  caseNumber: string | null;
  /** Human-readable QC notes for the audit trail */
  qcNotes: string[];
};

// Confidence thresholds for auto-accept vs escalate.
export const QC_DATE_ACCEPT = 70;
export const QC_CLASS_ACCEPT = 65;

/**
 * The QC supervisor takes Goblin's raw classification and decides, with
 * deterministic rules, what to auto-accept and what to escalate to a human.
 * No second LLM call by default — this is the cheap, fast triage layer.
 * It also applies obvious corrections (e.g. align record_status with case number).
 */
export function qcReview(c: ClassifyResult): QcDecision {
  const notes: string[] = [];
  let recordStatus = c.recordStatus;
  let recordStatusConfidence = c.recordStatusConfidence;
  let recordStatusSource: "goblin" | "qc" = "goblin";

  // Rule 1: case-number / record-status coherence correction.
  const cn = (c.caseNumber || "").toLowerCase();
  const looksFederal = /\d:\d{2}-cv-\d/.test(cn) || /-cv-/.test(cn);
  const looksState = /^cr\d/.test(cn) || /\bcr\d{2}-\d/.test(cn);
  if (looksFederal && recordStatus === "on_record_state") {
    recordStatus = "on_record_federal";
    recordStatusSource = "qc";
    notes.push("QC corrected state→federal based on federal case number pattern.");
  } else if (looksState && recordStatus === "on_record_federal") {
    recordStatus = "on_record_state";
    recordStatusSource = "qc";
    notes.push("QC corrected federal→state based on state case number pattern.");
  }

  // Rule 2: claims to be on-record but has no docket entry AND low confidence → downgrade.
  const onRecord = recordStatus === "on_record_state" || recordStatus === "on_record_federal";
  if (onRecord && !c.docketEntryNo && c.dateSource !== "filing_stamp" && recordStatusConfidence < QC_CLASS_ACCEPT) {
    recordStatus = "supporting";
    recordStatusSource = "qc";
    notes.push(
      "QC downgraded to 'supporting': claimed on-record but no docket entry, no filing stamp, and low confidence.",
    );
  }

  // Rule 3: date review escalation.
  const needsDateReview =
    c.dateSource === "undated" ||
    c.dateConfidence < QC_DATE_ACCEPT ||
    (c.dateSource === "file_metadata"); // metadata date is never authoritative for a court record
  if (needsDateReview) {
    notes.push(
      c.dateSource === "undated"
        ? "No filing stamp found — flagged UNDATED for human review."
        : `Date confidence ${c.dateConfidence}% below ${QC_DATE_ACCEPT}% (source: ${c.dateSource}) — flagged for review.`,
    );
  }

  // Rule 4: classification review escalation.
  const needsClassificationReview =
    recordStatus === "unclassified" || recordStatusConfidence < QC_CLASS_ACCEPT;
  if (needsClassificationReview) {
    notes.push(
      recordStatus === "unclassified"
        ? "Could not classify record status — escalated to human."
        : `Classification confidence ${recordStatusConfidence}% below ${QC_CLASS_ACCEPT}% — escalated to human.`,
    );
  }

  if (!needsDateReview && !needsClassificationReview && notes.length === 0) {
    notes.push("Auto-accepted: filing stamp and classification both above QC thresholds.");
  }

  return {
    filingStampDate: c.filingStampDate,
    dateSource: c.dateSource,
    dateConfidence: c.dateConfidence,
    dateSourceQuote: c.dateSourceQuote,
    recordStatus,
    recordStatusConfidence,
    recordStatusReason: c.recordStatusReason,
    recordStatusSource,
    needsDateReview,
    needsClassificationReview,
    docketEntryNo: c.docketEntryNo,
    caseNumber: c.caseNumber,
    qcNotes: notes,
  };
}
