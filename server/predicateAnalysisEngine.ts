/**
 * Predicate Analysis Engine
 *
 * For each timeline event, determines the expected predicate (supporting document,
 * ruling, finding, minute entry, or authority) and searches the document archive
 * to classify whether that predicate has been located.
 *
 * Language is intentionally court-safe:
 * - "Reviewed record does not locate…"
 * - "Predicate not found in reviewed materials…"
 * - "Supporting authority appears partial…"
 * - "The record should identify…"
 *
 * No legal conclusions. Record-integrity observations only.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { predicateFindings, timelineEvents, documents, documentViolationTags, violationTags } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export type PredicateStatus =
  | "located"
  | "partial"
  | "contradicted"
  | "not_located"
  | "off_record"
  | "needs_review";

export type SeverityCategory = "liberty" | "counsel" | "procedural" | "administrative";

export interface PredicateFindingResult {
  eventId: number;
  eventDate: Date;
  officialAct: string;
  actorName: string | null;
  predicateStatus: PredicateStatus;
  missingPredicate: string | null;
  whyItMatters: string | null;
  recommendedRequest: string | null;
  severityCategory: SeverityCategory;
  severityScore: number;
  confidence: number;
  sourceDocIds: number[];
  sourceEventIds: number[];
}

/**
 * Map timeline event category + issue tags to expected predicate types
 * so the LLM prompt is grounded in procedural reality.
 */
function getExpectedPredicateDescription(
  category: string,
  issueTags: string[],
  title: string,
): string {
  const tags = issueTags ?? [];

  if (category === "custody") {
    return "A signed court order, minute order, or transcript passage authorizing the custody action. For remand: findings supporting detention. For release revocation: written findings or minute entry.";
  }
  if (category === "warrant") {
    return "A signed warrant with probable cause affidavit, issuing judge's signature, and scope of authorization.";
  }
  if (category === "competency") {
    return "An order initiating competency proceedings with predicate findings, evaluator appointment order, and final competency determination signed by the court.";
  }
  if (category === "motion") {
    if (title.toLowerCase().includes("denied") || title.toLowerCase().includes("struck") || title.toLowerCase().includes("stricken")) {
      return "A written ruling or minute entry stating the basis for denial or striking, the legal authority cited, and the date of the ruling.";
    }
    if (title.toLowerCase().includes("granted")) {
      return "A written order granting the motion, stating the relief authorized and the legal basis.";
    }
    return "A filed motion document, any opposition, and a written ruling or minute entry disposing of the motion.";
  }
  if (tags.includes("faretta_self_representation") || title.toLowerCase().includes("faretta") || title.toLowerCase().includes("pro se") || title.toLowerCase().includes("self-rep")) {
    return "A Faretta colloquy on the record, written advisement of rights, and a signed waiver of counsel or court order addressing self-representation status.";
  }
  if (tags.includes("speedy_trial_delay") || title.toLowerCase().includes("continuance") || title.toLowerCase().includes("trial date")) {
    return "A written order or stipulation for continuance, identification of who requested the delay, and any speedy-trial waiver or objection on the record.";
  }
  if (title.toLowerCase().includes("substitution") || title.toLowerCase().includes("withdrawal") || title.toLowerCase().includes("counsel")) {
    return "A signed substitution of attorney form, court order approving withdrawal, and any Marsden hearing record if applicable.";
  }
  if (title.toLowerCase().includes("transfer") || title.toLowerCase().includes("department") || title.toLowerCase().includes("reassign")) {
    return "A written transfer order, reassignment notice, or presiding judge's order identifying the authority for the transfer.";
  }
  if (tags.includes("prosecutorial_misconduct")) {
    return "The underlying motion, any response, and a written ruling addressing the misconduct allegation. If sanctions were sought, a written order disposing of the sanctions motion.";
  }
  if (tags.includes("judicial_disqualification_bias") || title.toLowerCase().includes("recusal") || title.toLowerCase().includes("disqualif")) {
    return "A written recusal motion or affidavit of prejudice, and a written ruling or order addressing the disqualification request.";
  }
  if (category === "state_case" || category === "federal_case") {
    return "A filed document, docket entry, or minute order reflecting the official action and the court's authority for it.";
  }
  return "A source document, docket entry, minute order, or transcript passage confirming the official action and its legal basis.";
}

/**
 * Run predicate analysis for all timeline events in a story.
 * Returns structured findings without writing to DB — caller decides whether to persist.
 */
export async function analyzePredicates(
  storyId: number,
): Promise<PredicateFindingResult[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Load all public timeline events for this story
  const events = await db
    .select()
    .from(timelineEvents)
    .where(and(eq(timelineEvents.storyId, storyId), eq(timelineEvents.publicStatus, true)));

  if (events.length === 0) return [];

  // Load all approved public documents for context
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceType: documents.sourceType,
      aiSummary: documents.aiSummary,
      filingStampDate: documents.filingStampDate,
      documentDate: documents.documentDate,
      recordStatus: documents.recordStatus,
      caseNumber: documents.caseNumber,
      actorNames: documents.actorNames,
      issueTags: documents.issueTags,
    })
    .from(documents)
    .where(and(eq(documents.publicStatus, true), eq(documents.reviewStatus, "approved")));

  // Build a compact document index for the LLM
  const docIndex = docs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.sourceType,
    date: d.filingStampDate ?? d.documentDate,
    status: d.recordStatus,
    summary: d.aiSummary?.slice(0, 300) ?? null,
    actors: d.actorNames ?? null,
    tags: d.issueTags ?? [],
  }));

  const findings: PredicateFindingResult[] = [];

  // Process events in batches of 10 to avoid token limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    const eventsForPrompt = batch.map((e: (typeof events)[0]) => ({
      id: e.id,
      date: e.eventDate,
      title: e.title,
      category: e.category,
      issueTags: e.issueTags ?? [],
      actors: e.actors ?? [],
      sourceDocuments: e.sourceDocuments ?? [],
      expectedPredicate: getExpectedPredicateDescription(e.category, e.issueTags ?? [], e.title),
    }));

    const prompt = `You are a legal record-integrity analyst. Your job is to determine whether each official court action or procedural event has a locatable supporting predicate in the reviewed document archive.

CRITICAL RULES:
1. Do NOT make legal conclusions. Use only record-integrity language:
   - "Reviewed record does not locate…"
   - "Predicate not found in reviewed materials…"
   - "Supporting authority appears partial…"
   - "The record should identify…"
2. Do NOT use inflammatory language (corrupt, illegal, criminal, conspiracy, evil, wrong)
3. Phrase everything as a record observation, not a legal opinion
4. Be precise and calm. The power is in the specificity, not the tone.

DOCUMENT ARCHIVE (${docIndex.length} documents):
${JSON.stringify(docIndex.slice(0, 40), null, 2)}

EVENTS TO ANALYZE (${eventsForPrompt.length} events):
${JSON.stringify(eventsForPrompt, null, 2)}

For each event, return a JSON array with one object per event:
{
  "eventId": <number>,
  "predicateStatus": "located" | "partial" | "contradicted" | "not_located" | "off_record" | "needs_review",
  "missingPredicate": "<court-safe description of what predicate is missing, or null if located>",
  "whyItMatters": "<court-safe explanation of procedural significance, 1-2 sentences>",
  "recommendedRequest": "<specific record request to locate the predicate, e.g. 'Request signed minute order from [date] hearing'>",
  "severityCategory": "liberty" | "counsel" | "procedural" | "administrative",
  "severityScore": <1-10, 10=highest severity>,
  "confidence": <0-100>,
  "sourceDocIds": [<doc ids from archive that support or partially support this event>],
  "actorName": "<primary actor name from the event, or null>"
}

Predicate status definitions:
- located: A document in the archive clearly supports this action
- partial: Some support exists but key elements are missing (e.g., motion filed but no ruling located)
- contradicted: A document in the archive appears to conflict with or contradict this action
- not_located: No supporting predicate found in reviewed materials
- off_record: Action appears to have occurred outside the reviewed record (e.g., verbal order, external proceeding)
- needs_review: Insufficient information to classify

Severity categories:
- liberty: Affects custody, detention, bail, release, or physical freedom
- counsel: Affects right to counsel, attorney authority, or representation status
- procedural: Affects case proceedings, motions, rulings, or trial rights
- administrative: Routing, transfers, scheduling, or administrative actions

Return ONLY the JSON array. No preamble, no explanation.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a legal record-integrity analyst. Return only valid JSON arrays as instructed.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "predicate_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      eventId: { type: "integer" },
                      predicateStatus: {
                        type: "string",
                        enum: ["located", "partial", "contradicted", "not_located", "off_record", "needs_review"],
                      },
                      missingPredicate: { type: ["string", "null"] },
                      whyItMatters: { type: ["string", "null"] },
                      recommendedRequest: { type: ["string", "null"] },
                      severityCategory: {
                        type: "string",
                        enum: ["liberty", "counsel", "procedural", "administrative"],
                      },
                      severityScore: { type: "integer" },
                      confidence: { type: "integer" },
                      sourceDocIds: { type: "array", items: { type: "integer" } },
                      actorName: { type: ["string", "null"] },
                    },
                    required: [
                      "eventId", "predicateStatus", "missingPredicate", "whyItMatters",
                      "recommendedRequest", "severityCategory", "severityScore",
                      "confidence", "sourceDocIds", "actorName",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["findings"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) continue;

      let parsed: { findings: Array<{
        eventId: number;
        predicateStatus: PredicateStatus;
        missingPredicate: string | null;
        whyItMatters: string | null;
        recommendedRequest: string | null;
        severityCategory: SeverityCategory;
        severityScore: number;
        confidence: number;
        sourceDocIds: number[];
        actorName: string | null;
      }> };

      try {
        parsed = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        continue;
      }

      for (const finding of parsed.findings ?? []) {
        const event = batch.find((e) => e.id === finding.eventId);
        if (!event) continue;

        findings.push({
          eventId: event.id,
          eventDate: event.eventDate,
          officialAct: event.title,
          actorName: finding.actorName ?? (event.actors?.[0] ?? null),
          predicateStatus: finding.predicateStatus,
          missingPredicate: finding.missingPredicate,
          whyItMatters: finding.whyItMatters,
          recommendedRequest: finding.recommendedRequest,
          severityCategory: finding.severityCategory,
          severityScore: Math.min(10, Math.max(1, finding.severityScore)),
          confidence: Math.min(100, Math.max(0, finding.confidence)),
          sourceDocIds: finding.sourceDocIds ?? [],
          sourceEventIds: event.sourceDocuments ?? [],
        });
      }
    } catch (err) {
      console.error("[PredicateEngine] batch error:", err);
      // Add needs_review fallbacks for failed batch
      for (const event of batch as (typeof events)) {
        findings.push({
          eventId: event.id,
          eventDate: event.eventDate,
          officialAct: event.title,
          actorName: event.actors?.[0] ?? null,
          predicateStatus: "needs_review",
          missingPredicate: "Analysis could not be completed for this event. Manual review required.",
          whyItMatters: null,
          recommendedRequest: "Request all documents associated with this event from the clerk of court.",
          severityCategory: "procedural",
          severityScore: 5,
          confidence: 0,
          sourceDocIds: [],
          sourceEventIds: event.sourceDocuments ?? [],
        });
      }
    }
  }

  return findings;
}

/**
 * Persist findings to the predicate_findings table.
 * Deletes existing findings for the story before inserting new ones.
 */
export async function persistPredicateFindings(
  storyId: number,
  findings: PredicateFindingResult[],
  reportVersion: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Clear existing findings for this story
  await db.delete(predicateFindings).where(eq(predicateFindings.storyId, storyId));

  if (findings.length === 0) return;

  // Insert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < findings.length; i += BATCH) {
    const slice = findings.slice(i, i + BATCH);
    await db.insert(predicateFindings).values(
      slice.map((f) => ({
        storyId,
        eventId: f.eventId,
        eventDate: f.eventDate,
        officialAct: f.officialAct,
        actorName: f.actorName,
        predicateStatus: f.predicateStatus,
        missingPredicate: f.missingPredicate,
        whyItMatters: f.whyItMatters,
        recommendedRequest: f.recommendedRequest,
        severityCategory: f.severityCategory,
        severityScore: f.severityScore,
        confidence: f.confidence,
        sourceDocIds: f.sourceDocIds,
        sourceEventIds: f.sourceEventIds,
        reportVersion,
        generatedAt: new Date(),
      })),
    );
  }
}
