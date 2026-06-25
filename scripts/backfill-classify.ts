/**
 * One-off backfill: classify all existing documents with the v7.1 engine.
 * Reuses the exact classifyDocument + qcReview + db helpers (no logic duplication).
 * Run: cd /home/ubuntu/reno-record && npx tsx scripts/backfill-classify.ts
 */
import "dotenv/config";
import * as db from "../server/db";
import { classifyDocument, qcReview, extractText } from "../server/_goblin";
import { storageGetSignedUrl } from "../server/storage";

async function main() {
  const docs = await db.listDocumentsForClassification({
    onlyUnclassified: false, // reclassify everything for a clean baseline
    limit: 1000,
    afterId: 0,
  });
  console.log(`Classifying ${docs.length} documents...`);

  let done = 0;
  const tally: Record<string, number> = {};
  let undated = 0;
  let flagged = 0;

  for (const doc of docs) {
    try {
      let text = [doc.title, doc.description, doc.aiSummary].filter(Boolean).join("\n\n");
      if (doc.fileKey && doc.mimeType) {
        const signedUrl = await storageGetSignedUrl(doc.fileKey).catch(() => null);
        if (signedUrl) {
          const resp = await fetch(signedUrl).catch(() => null);
          if (resp && resp.ok) {
            const bytes = Buffer.from(await resp.arrayBuffer());
            const extracted = await extractText(bytes, doc.mimeType).catch(() => "");
            if (extracted && extracted.length > text.length) text = extracted;
          }
        }
      }

      const classification = await classifyDocument({
        filename: doc.title,
        mimeType: doc.mimeType || "application/octet-stream",
        text,
      });
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
          title: qc.docketEntryNo ? `${qc.caseNumber ?? "Case"} — ${qc.docketEntryNo}` : doc.title,
          recordStatus: qc.recordStatus,
          caseNumber: qc.caseNumber,
          filedDate: qc.filingStampDate ? new Date(qc.filingStampDate) : null,
        });
      }

      await db.updateDocument(doc.id, {
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
      } as any);

      await db.snapshotDocumentVersion({
        documentId: doc.id,
        changeNote: "v7.1 batch classification backfill",
        changedBy: null,
        changedBySource: "goblin",
      });

      tally[qc.recordStatus] = (tally[qc.recordStatus] ?? 0) + 1;
      if (qc.dateSource === "undated" || qc.needsDateReview) undated++;
      if (qc.needsClassificationReview) flagged++;
      done++;
      console.log(
        `  [${done}/${docs.length}] #${doc.id} → ${qc.recordStatus} (${qc.recordStatusConfidence}%) | date=${qc.dateSource} ${qc.filingStampDate ?? "—"}`,
      );
    } catch (e) {
      console.error(`  FAILED #${doc.id}:`, (e as Error).message);
    }
  }

  console.log("\n=== Backfill complete ===");
  console.log("By record status:", JSON.stringify(tally, null, 2));
  console.log(`Undated/flagged date: ${undated}`);
  console.log(`Flagged for classification review: ${flagged}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
