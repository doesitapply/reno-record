// Smoke test — same as batch-ingest.mjs but reads from /tmp/test_ingest.txt
import { readFileSync, writeFileSync } from "fs";
import { basename, extname } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: join(projectRoot, ".env") });
} catch {}

const { runGoblinPipeline } = await import(join(projectRoot, "server/_pipeline.ts"));
const db = await import(join(projectRoot, "server/db.ts"));

const ADMIN_ACTOR = { userId: null, role: "admin", source: "admin_batch" };

const fileList = readFileSync("/tmp/test_ingest.txt", "utf8")
  .split("\n").map(l => l.trim()).filter(Boolean);

console.log(`[TestIngest] Processing ${fileList.length} files...`);

for (const filePath of fileList) {
  const filename = basename(filePath);
  const storageFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 200);
  const buffer = readFileSync(filePath);
  const fileSize = buffer.length;

  try {
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

    console.log(`  ✓ doc ${result.documentId}: ${result.draft?.title || filename}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${filename} — ${err.message}`);
  }
}

console.log("[TestIngest] Done");
process.exit(0);
