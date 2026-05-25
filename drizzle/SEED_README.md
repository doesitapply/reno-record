# Database Seed Export

This file (`seed.sql`) contains a complete export of all seeded data from the reno-record database.

## What's included

| Table | Rows | Description |
|---|---|---|
| `users` | 2 | Admin and owner accounts |
| `agencies` | 10 | Washoe County agencies |
| `actors` | 17 | Judges, prosecutors, counsel, evaluators |
| `timeline_events` | 75 | All public timeline events (state + federal) |
| `documents` | 42 | Evidence archive documents |
| `violation_tags` | 15 | Constitutional/procedural violation tag definitions |
| `document_violation_tags` | 137 | Document-to-violation mappings with source quotes |
| `actor_document_links` | 30 | Actor-to-document associations |
| `actor_timeline_links` | 57 | Actor-to-timeline-event associations |
| `stories` | 1 | Published stories |
| `audit_log` | 36 | Audit trail entries |

## How to restore

After running schema migrations (`pnpm drizzle-kit generate` + `webdev_execute_sql`), restore data with:

```bash
# From the project root, using the DATABASE_URL environment variable:
mysql --host=<host> --port=<port> --user=<user> --password=<pass> --ssl-mode=REQUIRED <dbname> < drizzle/seed.sql
```

Or use the Manus database UI to run the SQL directly.

## Regenerating

To regenerate this file from the live database:

```bash
cd /home/ubuntu/reno-record && python3 /tmp/export_seed.py
```

The export script is at `/tmp/export_seed.py` in the sandbox. Copy it to the project root if you need it permanently.

## Notes

- This export uses `--no-create-info` — it only contains INSERT statements, not CREATE TABLE statements.
- Always run schema migrations before restoring seed data.
- The `users` table contains hashed passwords and session data — these are safe to commit (no plaintext secrets).
- Generated: 2026-05-25
