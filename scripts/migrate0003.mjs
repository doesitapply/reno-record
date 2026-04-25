import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync(
  "/home/ubuntu/reno-record/drizzle/0003_amused_mattie_franklin.sql",
  "utf8",
);
for (const stmt of sql.split("--> statement-breakpoint")) {
  const s = stmt.trim();
  if (!s) continue;
  try {
    await c.query(s);
    console.log("OK:", s.slice(0, 80));
  } catch (e) {
    console.error("FAIL:", s.slice(0, 80), "→", e.message);
    throw e;
  }
}

// Backfill visibility + aiPolicy from existing review_status / public_status
await c.query(
  "UPDATE documents SET visibility='public_preview' WHERE review_status='approved' AND public_status=1",
);
await c.query(
  "UPDATE documents SET visibility='private_admin_only' WHERE review_status='approved' AND public_status=0",
);
await c.query(
  "UPDATE documents SET visibility='rejected' WHERE review_status='rejected'",
);
await c.query(
  "UPDATE documents SET ai_policy='goblin_allowed' WHERE review_status='approved' AND public_status=1",
);

console.log("Migration 0003 applied + backfilled.");
await c.end();
