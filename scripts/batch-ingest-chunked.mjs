/**
 * Chunked batch ingest — processes files from /tmp/new_ingest_files.txt
 * in groups of 8 to manage memory pressure.
 * Run: npx tsx scripts/batch-ingest-chunked.mjs [startIndex] [endIndex]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: join(projectRoot, ".env") });
} catch {}

const { runGoblinPipeline } = await import(join(projectRoot, "server/_pipeline.ts"));
const { storagePut } = await import(join(projectRoot, "server/storage.ts"));
const db = await import(join(projectRoot, "server/db.ts"));

const MAX_BYTES = 15 * 1024 * 1024;
const ADMIN_ACTOR = { userId: null, role: "admin", source: "admin_batch" };

const args = process.argv.slice(2);
const startIdx = parseInt(args[0] ?? "0", 10);
const endIdx = parseInt(args[1] ?? "999", 10);

const allFiles = readFileSync("/tmp/new_ingest_files.txt", "utf8")
  .split("\n").map(l => l.trim()).filter(Boolean);

// Skip already-processed files from previous smoke test (docs 390001-390003)
const alreadyDone = new Set([
  "/home/ubuntu/upload/01-10-26motionforfindings.pdf",
  "/home/ubuntu/upload/01-19-26_DEFENDANTSNOTICEOFUNRESOLVEDSTRUCTURALERRORSJREQUESTFORSUBMISSIONJANDREQUE.pdf",
  "/home/ubuntu/upload/01-26-26MOTIONFORWRITTENFINDINGSONSPEEDYTRIALSTATUSANDBASISFOROUTSTANDINGWARRANT.pdf",
]);

const fileList = allFiles
  .filter(f => !alreadyDone.has(f))
  .slice(startIdx, endIdx);

console.log(`[BatchIngest] Processing files ${startIdx}-${Math.min(endIdx, startIdx + fileList.length - 1)} (${fileList.length} files)...`);

const resultsFile = "/tmp/batch-ingest-results.json";
const existing = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : { results: [] };
const results = existing.results || [];
let success = 0;
let failed = 0;

for (const filePath of fileList) {
  const filename = basename(filePath);
  const storageFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 200);

  try {
    const buffer = readFileSync(filePath);
    const fileSize = buffer.length;

    if (fileSize > MAX_BYTES) {
      console.log(`[OVERSIZED ${Math.round(fileSize/1024/1024)}MB] ${filename}`);
      const { key, url } = await storagePut(`evidence/batch-${storageFilename}`, buffer, "application/pdf");

      let extractedText = "";
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        extractedText = (parsed.text || "").slice(0, 60000);
      } catch {}

      const cleanTitle = filename.replace(/\.[^.]+$/, "").replace(/[_%^-]+/g, " ").replace(/\s+/g, " ").trim();
      const documentId = await db.insertDocument({
        title: cleanTitle,
        description: extractedText ? extractedText.slice(0, 500) : `Large exhibit pack (${Math.round(fileSize/1024/1024)}MB). Admin batch ingest.`,
        fileKey: key,
        fileUrl: url,
        mimeType: "application/pdf",
        fileSize,
        sourceType: "other",
        publicStatus: true,
        reviewStatus: "approved",
        visibility: "public_preview",
        aiPolicy: "no_ai_processing",
        aiSummary: extractedText ? `Large exhibit pack (${Math.round(fileSize/1024/1024)}MB). Extracted text preview: ${extractedText.slice(0, 300)}` : `Large exhibit pack (${Math.round(fileSize/1024/1024)}MB).`,
      });

      results.push({ file: filename, documentId, status: "oversized_direct", published: true });
      success++;
      console.log(`  ✓ doc ${documentId}: ${cleanTitle}`);
    } else {
      const result = await runGoblinPipeline({
        filename,
        storageFilename,
        mimeType: "application/pdf",
        buffer,
        fileSize,
        actor: ADMIN_ACTOR,
      });

      if (!result.published) {
        await db.updateDocument(result.documentId, {
          reviewStatus: "approved",
          publicStatus: true,
          visibility: "public_preview",
        });
      }

      results.push({
        file: filename,
        documentId: result.documentId,
        jobId: result.jobId,
        status: "pipeline",
        published: true,
        title: result.draft?.title,
      });
      success++;
      console.log(`  ✓ doc ${result.documentId}: ${result.draft?.title || filename}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${filename} — ${err.message}`);
    results.push({ file: filename, status: "failed", error: err.message });
    failed++;
  }

  // Save progress after each file
  writeFileSync(resultsFile, JSON.stringify({ total: allFiles.length, success: results.filter(r => r.status !== "failed").length, failed: results.filter(r => r.status === "failed").length, results }, null, 2));
}

console.log(`\n[BatchIngest] Chunk done: ${success} succeeded, ${failed} failed`);
process.exit(0);
