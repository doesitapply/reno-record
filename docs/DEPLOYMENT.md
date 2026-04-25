# The Reno Record — Deployment Guide

**Version:** 1.0 (platform release v3.5)

This document covers everything required to deploy, configure, and maintain The Reno Record on the Manus hosting platform.

---

## 1. Prerequisites

The Reno Record runs on the Manus web application platform (CloudRun + TiDB + S3). It does not require any external hosting account. The following are required before publishing:

- A Manus account with the project already initialized (already done if you are reading this)
- SMTP credentials for a transactional email provider (optional but strongly recommended for production)
- A custom domain (optional; the platform provides a default `*.manus.space` subdomain)

---

## 2. Environment variables

The following environment variables are required or optional. System-injected variables are provided automatically by the Manus platform and do not need to be set manually. Operator-configured variables must be set via the Secrets panel in the Management UI.

### 2.1 System-injected (automatic)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) |
| `OWNER_OPEN_ID` | Owner's Manus OAuth identifier |
| `OWNER_NAME` | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API base URL (server-side) |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for built-in APIs (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Bearer token for built-in APIs (frontend) |
| `VITE_FRONTEND_FORGE_API_URL` | Built-in API URL for frontend |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID |
| `VITE_APP_LOGO` | App logo URL |
| `VITE_APP_TITLE` | App title |

### 2.2 Operator-configured (set via Secrets panel)

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `SMTP_HOST` | Recommended | SMTP server hostname | `smtp.postmarkapp.com` |
| `SMTP_PORT` | Recommended | SMTP port | `587` |
| `SMTP_USER` | Recommended | SMTP username | `api-key-or-username` |
| `SMTP_PASS` | Recommended | SMTP password or API key | `your-smtp-password` |
| `SMTP_FROM` | Recommended | From address for outgoing email | `noreply@therenorecord.com` |

If any SMTP variable is missing, the application will start normally and log `[email] SMTP env missing — email skipped at runtime` for every email event. No email will be sent and no error will be thrown.

### 2.3 v4 Stripe variables (not yet required — see V4_MONETIZATION.md)

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | v4 only | Stripe server-side secret key |
| `STRIPE_WEBHOOK_SECRET` | v4 only | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | v4 only | Stripe publishable key (frontend) |

---

## 3. Publishing the application

Publishing is a one-click operation from the Manus Management UI.

1. Ensure a checkpoint has been saved. The Publish button is disabled until a checkpoint exists.
2. Open the Management UI (top-right panel icon).
3. Click **Publish** in the header. The platform builds the application, deploys it to CloudRun, and assigns the default `*.manus.space` subdomain.
4. The deployment typically completes in 2–4 minutes. The Dashboard panel shows deployment status.

**Important:** The deployed application connects to the same database as the development environment. Any data seeded or created in development is immediately visible in production after publishing.

---

## 4. Database migrations

Schema migrations must be applied before publishing a new version that includes schema changes.

The migration workflow is:

```bash
# 1. Edit drizzle/schema.ts with your changes
# 2. Generate the migration SQL
pnpm drizzle-kit generate

# 3. Review the generated SQL in drizzle/*.sql
# 4. Apply the migration via the migration runner script
node scripts/migrate000N.mjs
```

Each migration has a corresponding numbered runner script in `scripts/`. Do not apply migrations out of order. The current applied migrations are:

| Migration | Description |
|---|---|
| `0000_initial.sql` | Users table |
| `0001_special_supernaut.sql` | Stories, documents, timeline, actors, PRRs, agent_tasks |
| `0002_condemned_spiral.sql` | Chat sessions, chat messages, ingest jobs |
| `0003_amused_mattie_franklin.sql` | Audit log, visibility/aiPolicy columns, ownerUserId |

---

## 5. SMTP setup

The Reno Record supports any SMTP provider. The recommended providers for transactional email are:

| Provider | Free tier | Notes |
|---|---|---|
| Postmark | 100 emails/month | Best deliverability for transactional |
| SendGrid | 100 emails/day | Widely supported |
| Mailgun | 1,000 emails/month (3 months) | Good API |
| Amazon SES | 62,000 emails/month (from EC2) | Cheapest at scale |

To configure SMTP:

1. Create an account with your chosen provider and obtain SMTP credentials.
2. Open the Management UI → Settings → Secrets.
3. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
4. Save a new checkpoint and republish.

To verify SMTP is working, submit a test story through the public Submit form while logged in. You should receive a confirmation email at the address associated with your account.

---

## 6. Custom domain

The platform provides a default subdomain at `reno-record.manus.space` (or the project-specific prefix). To use a custom domain:

1. Open the Management UI → Settings → Domains.
2. Enter your custom domain (e.g., `therenorecord.com`).
3. Follow the DNS configuration instructions shown in the UI. Typically this involves adding a CNAME record pointing to the Manus CDN.
4. DNS propagation typically takes 5–30 minutes. The platform will automatically provision a TLS certificate.

Domains can be purchased directly through the Manus platform (Settings → Domains → Purchase) or transferred from an existing registrar.

---

## 7. Admin account setup

The project owner's Manus account is automatically promoted to `admin` role on first sign-in. The owner is identified by the `OWNER_OPEN_ID` environment variable, which is injected automatically.

To promote additional admins:

1. The target user must sign in to the platform at least once to create their account record.
2. Sign in as the owner/admin and navigate to `/admin`.
3. Open the **Users** tab.
4. Find the user and click **Make Admin**.

All role changes are recorded in the audit log.

---

## 8. Seeding initial content

The seed script at `scripts/seed.mjs` populates the database with the Church Record canonical case, five actors, nine timeline events, and four public records requests. It is idempotent — running it multiple times will not create duplicate records.

```bash
node scripts/seed.mjs
```

The seed script should be run once after the initial deployment. It does not need to be run again unless the database is reset.

---

## 9. Monitoring and health

The Management UI → Dashboard panel shows:

- Deployment status (running / stopped / error)
- Unique visitor and page view analytics
- Recent server logs

For deeper monitoring, the Manus platform provides CloudRun logs accessible via the Manus support portal.

---

## 10. Backup and recovery

The database is managed by the Manus platform (TiDB). Point-in-time recovery is available through Manus support. The operator does not have direct access to database backups.

For the evidence archive (S3), files are stored with the Manus-managed S3 service. Files are referenced by their `fileKey` in the `documents` table. If a file key is lost from the database, the file is effectively inaccessible (there is no delete endpoint, but there is also no browse endpoint).

**Recommendation:** Maintain a local copy of all uploaded evidence files. The admin can download individual files from the Evidence Archive admin view. There is no bulk export tool in v3.5.

---

## 11. Pre-launch checklist

Before making the site public, verify the following:

- [ ] SMTP credentials are set and a test email has been received
- [ ] Custom domain is configured and TLS certificate is active
- [ ] At least one story is in `status: "approved"` and `publicPermission: true`
- [ ] At least one document is in `reviewStatus: "approved"` and `publicStatus: true`
- [ ] At least one timeline event is in `publicStatus: true`
- [ ] The Church Record featured story is seeded and approved
- [ ] All actors have `publicStatus: true` set appropriately
- [ ] The audit log is empty (no test actions from development should be present in production)
- [ ] The admin panel is accessible at `/admin` after signing in
- [ ] The Docket Goblin bubble appears in the admin panel and responds to a test message
- [ ] The Submit page shows the sign-in CTA for unauthenticated users
- [ ] The Submit page shows the form for authenticated users
- [ ] A test submission has been made and appears in the admin moderation queue
