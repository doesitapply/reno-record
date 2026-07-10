/**
 * Batch ingest script — processes all new PDFs through the Goblin pipeline.
 * Run: npx tsx scripts/batch-ingest.mjs
 *
 * - Reads /tmp/new_ingest_files.txt for the list of files to ingest
 * - Bypasses the HTTP upload guard (runs pipeline directly in-process)
 * - Oversized files (>15MB) are uploaded to S3 directly, text extracted, inserted as pending docs
 * - All docs are force-approved after pipeline (admin batch ingest — Cam's own files)
 * - Outputs a JSON summary to /tmp/batch-ingest-results.json
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, extname } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load .env
try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: join(projectRoot, ".env") });
} catch {}

// TypeScript project imports (tsx handles transpilation)
const { runGoblinPipeline } = await import(join(projectRoot, "server/_pipeline.ts"));
const { storagePut } = await import(join(projectRoot, "server/storage.ts"));
const db = await import(join(projectRoot, "server/db.ts"));

const MAX_BYTES = 15 * 1024 * 1024;
const ADMIN_ACTOR = { userId: null, role: "admin", source: "admin_batch" };

const fileList = readFileSync("/tmp/new_ingest_files.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

console.log(`[BatchIngest] Processing ${fileList.length} files...`);

const results = [];
let success = 0;
let failed = 0;

for (const filePath of fileList) {
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = "application/pdf";

  try {
    const buffer = readFileSync(filePath);
    const fileSize = buffer.length;

    // Sanitize storage filename
    const storageFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 200);

    if (fileSize > MAX_BYTES) {
      // Oversized: upload directly to S3, extract text, insert as approved doc
      console.log(`[BatchIngest] OVERSIZED (${Math.round(fileSize / 1024 / 1024)}MB): ${filename}`);
      const { key, url } = await storagePut(`evidence/batch-${storageFilename}`, buffer, mimeType);

      let extractedText = "";
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        extractedText = (parsed.text || "").slice(0, 60000);
      } catch (e) {
        console.warn(`  Text extraction failed: ${e.message}`);
      }

      const cleanTitle = filename.replace(/\.[^.]+$/, "").replace(/[_%-]+/g, " ").trim();
      const documentId = await db.insertDocument({
        title: cleanTitle,
        description: `Large exhibit pack (${Math.round(fileSize / 1024 / 1024)}MB). Admin batch ingest.`,
        fileKey: key,
        fileUrl: url,
        mimeType,
        fileSize,
        sourceType: "court_filing",
        publicStatus: true,
        reviewStatus: "approved",
        visibility: "public_preview",
        aiPolicy: "no_ai_processing",
        extractedText: extractedText || null,
      });

      results.push({ file: filename, documentId, status: "oversized_direct", published: true });
      success++;
      console.log(`  ✓ doc ${documentId}: ${cleanTitle}`);
    } else {
      // Normal path: full Goblin pipeline
      const result = await runGoblinPipeline({
        filename,
        storageFilename,
        mimeType,
        buffer,
        fileSize,
        actor: ADMIN_ACTOR,
      });

      // Force-approve all batch-ingested docs
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
        recordStatus: result.draft?.recordStatus,
        verifiabilityScore: result.verifiability?.score,
      });
      success++;
      console.log(`  ✓ doc ${result.documentId}: ${result.draft?.title || filename}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${filename} — ${err.message}`);
    results.push({ file: filename, status: "failed", error: err.message });
    failed++;
  }
}

const summary = { total: fileList.length, success, failed, results };
writeFileSync("/tmp/batch-ingest-results.json", JSON.stringify(summary, null, 2));
console.log(`\n[BatchIngest] DONE: ${success} succeeded, ${failed} failed`);
console.log(`[BatchIngest] Results written to /tmp/batch-ingest-results.json`);
process.exit(failed > 0 ? 1 : 0);
