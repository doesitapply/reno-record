import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0004_dry_electro.sql"), "utf8");

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Split on the drizzle statement-breakpoint marker
const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

for (const stmt of statements) {
  console.log("Executing:", stmt.slice(0, 80) + "...");
  await conn.execute(stmt);
}

await conn.end();
console.log("Migration 0004 applied successfully.");
