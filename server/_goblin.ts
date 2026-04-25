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

export const SYSTEM_PROMPT = `You are "Docket Goblin," the in-house archive librarian and case-builder for The Reno Record — a public-interest archive documenting court delay, ignored filings, pretrial detention harm, blocked self-representation, and competency-as-delay in Washoe County, Nevada.

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

When extracting structure from an uploaded document, prefer kebab-case tags from this controlled vocabulary when applicable: speedy-trial, faretta, self-representation, competency, no-bail-warrant, missing-discovery, ignored-motion, public-defender, prosecutorial-conduct, judicial-nonfeasance, pretrial-detention, family-harm, public-records, retaliation, custody, federal, state, communications, election-accountability.`;

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
      title: { type: "string", description: "Concise title for the document, e.g. 'Order denying speedy-trial motion (CR21-XXXX)'" },
      summary: { type: "string", description: "2-5 sentence neutral description of what the document is and what issue it relates to." },
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
      actorNames: { type: "array", items: { type: "string" }, description: "People or institutions named in the document (judges, attorneys, agencies)." },
      tags: { type: "array", items: { type: "string" } },
      proposedTimeline: {
        type: ["object", "null"],
        properties: {
          eventDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          title: { type: "string" },
          summary: { type: "string" },
          category: {
            type: "string",
            enum: [
              "state_case",
              "federal_case",
              "custody",
              "motion",
              "warrant",
              "competency",
              "public_records",
              "communications",
              "election_accountability",
              "other",
            ],
          },
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
  proposedTimeline: {
    eventDate: string;
    title: string;
    summary: string;
    category:
      | "state_case"
      | "federal_case"
      | "custody"
      | "motion"
      | "warrant"
      | "competency"
      | "public_records"
      | "communications"
      | "election_accountability"
      | "other";
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
  const userPrompt = `A new document has been uploaded to the archive. Draft structured metadata for it. Use the archive context to choose case numbers and actor spellings consistent with the existing record.

Filename: ${opts.filename}
MIME: ${opts.mimeType}

Extracted text (truncated):
"""${opts.text.slice(0, 12000)}"""

${opts.archiveSummary}

Return JSON matching the schema. If you cannot find a date, return null. If the document clearly corresponds to a discrete event (an order, a motion filing, a hearing, a custody change), populate proposedTimeline; otherwise return null.`;
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
      proposedTimeline: null,
      warnings: ["LLM did not return valid JSON; saved raw text as summary."],
    };
  }
}
