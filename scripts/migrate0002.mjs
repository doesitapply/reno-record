import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";

const c = await mysql.createConnection(process.env.DATABASE_URL);
const sql = fs.readFileSync("drizzle/0002_condemned_spiral.sql", "utf8");
for (const stmt of sql.split("--> statement-breakpoint")) {
  const s = stmt.trim();
  if (!s) continue;
  try {
    await c.query(s);
    console.log("ok:", s.split("\n")[0].slice(0, 90));
  } catch (e) {
    console.error("ERR:", e.message, "::", s.slice(0, 80));
  }
}
await c.end();
