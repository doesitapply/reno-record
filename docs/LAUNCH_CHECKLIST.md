# The Reno Record — Operator Launch Checklist

**Status:** Pre-launch · v3.6  
**Estimated time to complete:** 45–90 minutes (mostly waiting on DNS propagation)

This checklist covers every step you need to execute personally — things that require real files, credentials, or external accounts that cannot be wired by code. Everything else is already built and tested.

---

## 1. Publish the Site (5 minutes)

The site is built and checkpoint `0461e127` is stable.

1. Open the Management UI (right panel in Manus).
2. Click **Publish** in the top-right header.
3. The site will be live at `reno-record.manus.space` within 60 seconds.
4. Confirm by visiting the URL and checking the Home page loads.

> You must publish before any of the following steps will work end-to-end.

---

## 2. Connect a Custom Domain (15 minutes + DNS propagation)

**Recommended:** `therenorecord.com`

### Option A — Buy through Manus (easiest)
1. Management UI → **Settings** → **Domains**.
2. Click **Purchase a domain**.
3. Search `therenorecord.com`, complete purchase.
4. Manus auto-assigns it to this project. Done.

### Option B — Bring your own domain
1. Buy `therenorecord.com` at Namecheap, Cloudflare, or Google Domains.
2. Management UI → **Settings** → **Domains** → **Bind existing domain**.
3. Enter `therenorecord.com`.
4. Copy the CNAME record shown (e.g. `reno-record.manus.space`).
5. In your registrar's DNS panel, add:
   - Type: `CNAME`
   - Host: `@` (or `www`)
   - Value: the target shown in Manus
6. Wait 5–60 minutes for DNS propagation.
7. Return to Manus Domains panel and click **Verify**.

### After domain is live
- Update `client/public/sitemap.xml` — replace `https://reno-record.manus.space` with `https://therenorecord.com`.
- Update `client/src/hooks/useSEO.ts` — replace the `defaultUrl` base with `https://therenorecord.com`.
- Save a new checkpoint and republish.

---

## 3. Set SMTP Credentials (10 minutes)

Without SMTP, all emails are skipped (logged as `email_skipped` in the audit log). The site works fine without it, but submitters get no confirmation.

### Recommended: Gmail App Password (free, reliable)
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
2. Create an app password for "Mail" → "Other" → name it "Reno Record".
3. Copy the 16-character password.

### Set the secrets in Manus
1. Management UI → **Settings** → **Secrets**.
2. Add the following:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | the 16-char app password |
| `SMTP_FROM` | `The Reno Record <you@gmail.com>` |

3. Save. The server picks up env changes on next deploy.
4. Republish.

### Test it
Submit a test story through `/submit` while logged in. You should receive a confirmation email within 2 minutes. Check the audit log at `/admin` → Audit tab to confirm `email_sent` appears on the submission entry.

### Alternative: SendGrid (better deliverability at scale)
1. Create a free SendGrid account at [sendgrid.com](https://sendgrid.com).
2. Create an API key with "Mail Send" permission.
3. Set:
   - `SMTP_HOST` = `smtp.sendgrid.net`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `apikey` (literally the string "apikey")
   - `SMTP_PASS` = your SendGrid API key
   - `SMTP_FROM` = a verified sender address

---

## 4. Upload Evidence (variable — 30 min to several hours)

This is the most important operator task. The archive, timeline, and actor dossiers are structurally complete but empty until you upload real PDFs.

### Workflow (use the Docket Goblin bubble)

1. Log in at `/admin` (your account is auto-promoted to admin).
2. Look for the **Docket Goblin** chat bubble in the bottom-right corner.
3. Open it. You'll see a drop zone.
4. Drag one or more PDFs onto the drop zone (max 15 MB each, max 10 at a time).
5. The Goblin will:
   - Extract text from the PDF
   - Draft a title, summary, tags, source type, case number, and actor names
   - Create a pending document entry in the archive
   - Optionally draft a timeline event for the document's date
6. Review the draft in the Goblin's response. It shows a link to the Admin panel.
7. Go to `/admin` → **Ingest** tab to review all pending Goblin drafts.
8. Click **Approve** on each one you want to publish.
9. Approved documents appear in the Evidence Archive at `/evidence`.

### Priority upload order (suggested)
Start with the documents that anchor the Church Record narrative:

| Priority | Document type | Why |
|---|---|---|
| 1 | Original charging documents / docket | Establishes the case |
| 2 | Any court orders denying motions | Core pattern evidence |
| 3 | Competency evaluation orders | Key procedural detour |
| 4 | Bail/warrant orders | No-bail warrant pattern |
| 5 | Any written communications from court | Silence pattern |
| 6 | Public records request responses (or non-responses) | PRR pattern |
| 7 | Any DA/PD filings | Actor documentation |

### After uploading
- Go to `/admin` → **Documents** tab.
- For each approved document, set **Visibility** to `public_preview` (free tier) or `receipts_only` (paid tier, for after Stripe is wired).
- Set **AI Policy** to `goblin_allowed` if you want the Goblin to reference it in chat answers.

---

## 5. Create Actor Profiles (15 minutes)

Actor dossier pages are live but only show actors you've created.

1. Go to `/admin/manage` (or click **Content Management** in the Admin panel header).
2. Click the **Actors** tab.
3. Click **New Actor**.
4. Fill in:
   - **Name** (exact — this is matched against document `actorNames` and timeline `actors` fields)
   - **Role** (e.g. "District Court Judge", "Deputy District Attorney")
   - **Agency** (e.g. "Second Judicial District Court, Washoe County")
   - **Judicial Actor** checkbox if applicable
   - **Bio** and **Notes** (notes appear as "Conduct on record" on the dossier page)
5. Save.
6. The actor's dossier at `/actors/[slug]` will automatically aggregate all timeline events and documents where their name appears.

> **Critical:** The name you enter here must exactly match how the name appears in document `actorNames` and timeline `actors` fields. If documents say "Barry Breslow" and the actor profile says "B. Breslow", they won't link. Use the Goblin's extracted actor names as the canonical form.

---

## 6. Build Out the Timeline (10 minutes)

The seeded timeline has 9 placeholder events. Replace or supplement with real docket events.

1. Go to `/admin/manage` → **Timeline** tab.
2. For each real docket event:
   - Click **New Event**
   - Set date, category, title, summary, status (`confirmed` or `alleged`)
   - Add actor names (comma-separated, must match actor profile names exactly)
   - Add the case number
   - Link source documents by ID (find document IDs in the Documents tab)
3. Save.

---

## 7. Update Public Records Requests (5 minutes)

1. Go to `/admin/manage` → **Public Records** tab.
2. Edit the 4 seeded PRRs to reflect your real requests, or delete and recreate them.
3. Add new PRRs as you file them.

---

## 8. Pre-Launch Verification Checklist

Run through these before announcing:

- [ ] Home page loads at custom domain
- [ ] Navigation links all work
- [ ] `/the-church-record` has real content (not just the seeded placeholder)
- [ ] `/timeline` shows at least 5 real events
- [ ] `/evidence` shows at least 3 approved documents
- [ ] `/actors` shows at least 1 actor profile
- [ ] `/submit` requires sign-in (test in incognito)
- [ ] Submit a test story → receive confirmation email
- [ ] Admin approves test story → submitter receives decision email
- [ ] `/admin` audit log shows all actions
- [ ] Docket Goblin chat bubble visible in admin, not visible in incognito
- [ ] `/sitemap.xml` returns valid XML with correct domain
- [ ] `/robots.txt` returns correctly
- [ ] OG image appears when you paste the URL into Twitter/Slack (use [opengraph.xyz](https://opengraph.xyz) to test)

---

## 9. Post-Launch: Stripe Paywall (when ready)

The V4 monetization spec is at `docs/V4_MONETIZATION.md`. Before implementing:

1. Answer the 12 open questions in that doc.
2. Decide which documents are `public_preview` vs `receipts_only` in the admin Documents tab.
3. Give the go-ahead and Stripe will be wired in the next build pass.

---

## Quick Reference: Admin URLs

| URL | Purpose |
|---|---|
| `/admin` | Moderation queue, audit log, user management, doc visibility |
| `/admin/manage` | Create/edit timeline events, actors, PRRs |
| `/evidence` | Public evidence archive |
| `/actors` | Public actor dossiers |
| `/timeline` | Public timeline |
| `/public-records` | Public PRR tracker |
| `/submit` | Story submission (requires sign-in) |

---

## Support

If something breaks or a procedure fails, check:
1. `/admin` → Audit tab → filter by `upload_rejected` or `email_skipped`
2. The `docs/` folder for architecture and security docs
3. The `STATE_REPORT.md` in the project root for a full system inventory
