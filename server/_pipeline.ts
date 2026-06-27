/**
 * Shared Goblin ingest pipeline.
 *
 * Single code path used by BOTH:
 *   - the admin tRPC `document.ingest` procedure, and
 *   - the public REST `POST /api/public/ingest` endpoint (ingest-scoped API key).
 *
 * HARD SAFETY GUARANTEES (identical for every caller):
 *   - documents are created with publicStatus=false, reviewStatus="pending"
 *   - nothing is published unless the verifiability score clears AUTO_PUBLISH_THRESHOLD
 *   - QC supervisor + immutable v1 snapshot always run
 *
 * Callers are responsible for: upload validation, credit gating, and rate limiting
 * (those policies differ per surface). This helper assumes the buffer is already validated.
 */
import { storagePut } from "./storage";
import * as db from "./db";
import {
  buildArchiveContextString,
  draftFromExtractedText,
  extractText,
  classifyDocument,
  qcReview,
} from "./_goblin";
import { writeAudit } from "./_uploadGuard";
import { notifyOwner } from "./_core/notification";
import { scoreVerifiability, AUTO_PUBLISH_THRESHOLD } from "./goblinAutoPublish";

export type GoblinPipelineActor = {
  /** DB user id for audit attribution. null for non-user callers (e.g. API key). */
  userId: number | null;
  /** Role string for audit attribution. */
  role: string | null;
  /** Trigger surface, recorded in audit metadata (`via`). */
  source: "goblin" | "api";
};

export type RunGoblinPipelineOpts = {
  /** Validated, safe filename (already passed validateUpload). */
  filename: string;
  /** Safe filename for storage key (validateUpload's storageFilename). */
  storageFilename: string;
  mimeType: string;
  buffer: Buffer;
  fileSize: number;
  storyId?: number | null;
  actor: GoblinPipelineActor;
};

export type RunGoblinPipelineResult = {
  jobId: number;
  documentId: number;
  draft: any;
  proposedActors: Array<{ id: number; name: string }>;
  verifiability: ReturnType<typeof scoreVerifiability>;
  published: boolean;
};

export async function runGoblinPipeline(
  opts: RunGoblinPipelineOpts,
): Promise<RunGoblinPipelineResult> {
  const { filename, storageFilename, mimeType, buffer, fileSize, actor } = opts;

  const jobId = await db.insertIngestJob({
    userId: actor.userId ?? null,
    storyId: opts.storyId ?? null,
    filename,
    mimeType,
    fileSize,
    status: "pending",
  });

  try {
    const { key, url } = await storagePut(
      `evidence/ingest-${jobId}-${storageFilename}`,
      buffer,
      mimeType,
    );

    const extracted = await extractText(buffer, mimeType);
    await db.updateIngestJob(jobId, {
      status: "extracted",
      extractedText: extracted.slice(0, 60000) || null,
    });

    // Draft structured metadata (archive context keeps naming consistent)
    const archive = await db.getArchiveContextForLLM();
    const archiveStr = buildArchiveContextString(archive);
    const draft = await draftFromExtractedText({
      filename,
      mimeType,
      text: extracted,
      archiveSummary: archiveStr,
    });

    // Resolve story: default to featured (Church Record) story when not supplied.
    let storyId = opts.storyId ?? null;
    if (!storyId) {
      const featured = await db.getFeaturedStory();
      if (featured) storyId = featured.id;
    }

    // Create pending document — NEVER public, NEVER approved automatically.
    const documentId = await db.insertDocument({
      title: draft.title || filename,
      description: draft.summary,
      fileKey: key,
      fileUrl: url,
      mimeType,
      fileSize,
      sourceType: draft.sourceType,
      caseNumber: draft.caseNumber || null,
      documentDate: draft.documentDate ? new Date(draft.documentDate) : undefined,
      actorNames: draft.actorNames.join(", "),
      issueTags: draft.tags,
      storyId: storyId ?? undefined,
      publicStatus: false, // hard guarantee
      reviewStatus: "pending", // hard guarantee
      visibility: "pending_review",
      aiPolicy: "no_ai_processing",
      uploadedBy: actor.userId ?? undefined,
      aiSummary: draft.summary,
      aiTags: draft.tags,
    });

    await writeAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "document_ingested",
      targetType: "document",
      targetId: documentId,
      metadata: { filename, jobId, storyId, via: actor.source },
    });

    // SMARTER ENGINE: real filing-stamp date + record-status classification + QC supervisor.
    try {
      const classification = await classifyDocument({ filename, mimeType, text: extracted });
      const qc = qcReview(classification);

      const legacyCaseTag =
        qc.recordStatus === "on_record_federal"
          ? "federal"
          : qc.recordStatus === "on_record_state"
          ? "state"
          : undefined;

      let filingPackageId: number | undefined;
      if (
        (qc.recordStatus === "on_record_state" || qc.recordStatus === "on_record_federal") &&
        (qc.docketEntryNo || qc.caseNumber)
      ) {
        filingPackageId = await db.findOrCreateFilingPackage({
          docketEntryNo: qc.docketEntryNo,
          title: qc.docketEntryNo
            ? `${qc.caseNumber ?? "Case"} — ${qc.docketEntryNo}`
            : draft.title || filename,
          recordStatus: qc.recordStatus,
          caseNumber: qc.caseNumber,
          filedDate: qc.filingStampDate ? new Date(qc.filingStampDate) : null,
        });
      }

      await db.updateDocument(documentId, {
        filingStampDate: qc.filingStampDate ? new Date(qc.filingStampDate) : undefined,
        dateSource: qc.dateSource,
        dateConfidence: qc.dateConfidence,
        needsDateReview: qc.needsDateReview,
        dateSourceQuote: qc.dateSourceQuote ?? undefined,
        recordStatus: qc.recordStatus,
        recordStatusConfidence: qc.recordStatusConfidence,
        recordStatusSource: qc.recordStatusSource,
        recordStatusReason: qc.recordStatusReason ?? undefined,
        needsClassificationReview: qc.needsClassificationReview,
        filingPackageId,
        ...(legacyCaseTag ? { caseTag: legacyCaseTag as any } : {}),
        ...(qc.dateSource === "filing_stamp" && qc.filingStampDate
          ? { documentDate: new Date(qc.filingStampDate) }
          : {}),
      });

      await writeAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: "document_ingested",
        targetType: "document",
        targetId: documentId,
        metadata: {
          phase: "classify_qc",
          recordStatus: qc.recordStatus,
          recordStatusConfidence: qc.recordStatusConfidence,
          dateSource: qc.dateSource,
          dateConfidence: qc.dateConfidence,
          needsDateReview: qc.needsDateReview,
          needsClassificationReview: qc.needsClassificationReview,
          qcNotes: qc.qcNotes,
        },
      });

      if (qc.needsDateReview || qc.needsClassificationReview) {
        await notifyOwner({
          title: "Goblin escalation: document needs review",
          content: `"${draft.title || filename}" — ${qc.qcNotes.join(" ")}`,
        }).catch(() => {});
      }
    } catch (classifyErr) {
      console.error("[pipeline] classify/QC step failed (non-fatal):", classifyErr);
    }

    // Immutable v1 snapshot of the document's initial state.
    await db
      .snapshotDocumentVersion({
        documentId,
        changeNote:
          actor.source === "api" ? "Initial Goblin ingest (via API)" : "Initial Goblin ingest",
        changedBy: actor.userId ?? undefined,
        // Snapshot records the producing pipeline (Goblin), not the trigger surface.
        changedBySource: "goblin",
      })
      .catch((e) => console.error("[pipeline] snapshot failed (non-fatal):", e));

    // Score verifiability and potentially auto-publish.
    const verifResult = scoreVerifiability(draft);
    const proposed = await db.findActorIdsByNames(draft.actorNames);
    const enrichedDraft = { ...draft, _verifiability: verifResult };
    await db.updateIngestJob(jobId, {
      status: "drafted",
      documentId,
      draftJson: enrichedDraft as any,
      proposedActors: proposed.map((p) => p.name),
      storyId: storyId ?? null,
    });

    let published = false;
    if (verifResult.verdict === "auto_publish" && verifResult.score >= AUTO_PUBLISH_THRESHOLD) {
      await db.updateDocument(documentId, {
        reviewStatus: "approved",
        publicStatus: true,
        visibility: "public_preview",
      });
      await writeAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: "document_approved",
        targetType: "document",
        targetId: documentId,
        metadata: { via: "auto_publish", verifiabilityScore: verifResult.score, jobId },
      });
      await db.updateIngestJob(jobId, { status: "approved" });
      published = true;
    }

    return {
      jobId,
      documentId,
      draft: enrichedDraft,
      proposedActors: proposed,
      verifiability: verifResult,
      published,
    };
  } catch (e: any) {
    await db.updateIngestJob(jobId, {
      status: "failed",
      error: String(e?.message || e),
    });
    throw e;
  }
}
