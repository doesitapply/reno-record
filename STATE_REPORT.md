# The Reno Record — State Report (as of 2026-05-18)

## 1. Build & Infra

| Layer | Tech | Status |
|---|---|---|
| Runtime | Node.js 22 / Express 4 / tRPC 11 | Running |
| Frontend | React 19 / Vite / Tailwind CSS 4 | Building |
| Database | MySQL/TiDB via Drizzle ORM | Connected |
| Storage | S3 via AWS SDK v3 | Active |
| LLM | Manus Forge (invokeLLM) | Active |
| Auth | Manus OAuth (JWT session cookie) | Active |
| Hosting | Manus CloudRun (therenorecord.manus.space) | Live |
| Tests | Vitest — 73/73 passing | Green |
| TypeScript | 0 errors | Clean |

---

## 2. Schema version

Migration 0005 applied. All v4.0 relational tables are live in the production database.

| Migration | Description |
|---|---|
| 0000 | `users` table |
| 0001 | Core tables: `stories`, `documents`, `timeline_events`, `actors`, `public_records_requests`, `agent_tasks` |
| 0002 | Goblin tables: `chat_sessions`, `chat_messages`, `ingest_jobs` |
| 0003 | `audit_log` |
| 0004 | `review_requests`; soft-delete columns on `stories` and `documents` |
| 0005 | v4.0 relational layer: `agencies`, `violation_tags`, `document_violation_tags`, `actor_agency_roles`, `actor_document_links`, `actor_timeline_links`; `status_history` on `public_records_requests` |

---

## 3. Features complete

### Core platform
- Public evidence archive (stories, documents, timeline, actors, PRRs)
- Structured intake form (Submit Evidence) with consent, redaction confirmation, and rate limiting
- Docket Goblin: AI-assisted ingest pipeline with human approval gate
- Admin panel: story/document moderation, visibility control, audit log, user management
- Review request system (user-initiated correction/removal/redaction)
- Soft-delete + restore for stories and documents
- Inline field editing with audit trail
- PRR status history tracking

### v4.0 Relational Intelligence Layer
- **Agency registry**: 10 Washoe County seed labels; generic schema supports any jurisdiction
- **Violation taxonomy**: 15 generic procedural violation tags across 9 categories
- **Structured joins**: `actor_agency_roles`, `actor_document_links`, `actor_timeline_links`, `document_violation_tags`
- **Source quote enforcement**: `document_violation_tags.source_quote NOT NULL` — no unsupported AI assertions
- **Goblin integration**: `approveIngest` writes actor-document links and violation tags from LLM draft; all Goblin-generated entries marked `addedBy: "goblin"`, `confidence < 100` for human review
- **Agency hub pages**: `/agencies` index and `/agencies/:slug` detail with actor roster and document list
- **Actor dossier v4.0**: agency role history, linked violation tags with source quotes, linked documents
- **Admin tabs**: Agency CRUD, Violation Tag taxonomy management

---

## 4. Known issues / gaps

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | `patterns.metrics` query returns nulls for all pattern counts | Medium | Metrics depend on story fields populated via intake; no approved stories yet |
| 2 | Actor dossier does not yet aggregate related timeline events | Low | `actor_timeline_links` table exists; UI not wired |
| 3 | No per-page SEO meta tags | Low | Generic title/description on all pages |
| 4 | No mobile QA pass | Low | Desktop-first design; responsive but untested on small screens |
| 5 | Goblin source quotes are AI-generated descriptions, not verified document excerpts | By design | Marked `addedBy: "goblin"`, `confidence < 100`; human curation required |
| 6 | Actor-agency role management panel not yet in Admin UI | Low | Procedures exist; UI tab not built |

---

## 5. Pending (not started)

### Premium tier (v4, spec only)
- Two-tier model (free public / paid Receipts): `subscriber` role, Stripe integration, `<Paywall>` wrapper, gated procedures
- Pricing: $9/mo or $90/yr + $250 Founding Subscriber lifetime (capped at 100) — awaiting confirmation
- Requires: `webdev_add_feature stripe`, Stripe keys, pricing page

### Other
- Per-page SEO meta tags (title, description, OG)
- Custom domain (therenorecord.com or renorecord.org — purchasable in-app)
- Mobile QA pass
- First real evidence uploads (requires approved content)

---

## 6. Secrets & Keys

### Already injected (in env, no action needed)

| Name | Used for |
|---|---|
| `DATABASE_URL` | TiDB connection |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | Manus OAuth |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Auto-admin promotion |
| `BUILT_IN_FORGE_API_KEY` / `BUILT_IN_FORGE_API_URL` | Server-side LLM calls (Goblin chat + ingest) |
| `VITE_FRONTEND_FORGE_API_KEY` / `VITE_FRONTEND_FORGE_API_URL` | Frontend LLM (currently unused; server-side only) |

### Missing — required for next phases

| Name | Required for | Source |
|---|---|---|
| `STRIPE_SECRET_KEY` | Premium subscriptions (v4) | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Subscription lifecycle webhooks | Stripe dashboard |
| `STRIPE_PRICE_MONTHLY` | Price ID for $9/mo | Created in Stripe after pricing approval |
| `STRIPE_PRICE_YEARLY` | Price ID for $90/yr | Same |
| `STRIPE_PRICE_FOUNDING` | Price ID for $250 lifetime | Same |

---

## 7. Tests

73/73 passing across three suites:

- `auth.logout.test.ts` — session clear behavior
- `renoRecord.test.ts` — moderation gating, consent enforcement, admin-only RBAC, Docket Goblin advisory-only behavior, chat + ingest RBAC, no-auto-publish on ingest, admin-only approveIngest, PRR status-history create/update validation, public evidence URL normalization
- `storageProxy.test.ts` — evidence files stream inline through `/manus-storage/*`; HEAD probes do not fall through to SPA fallback

---

## 8. Recommended next sequence

1. **Upload first real evidence documents** through Docket Goblin to validate the full ingest pipeline with live data.
2. **Curate Goblin-generated tags**: review `addedBy: "goblin"` entries in Admin, replace AI-generated source quotes with verified document excerpts, set `confidence: 100`.
3. **Add actor-agency role management panel** in Admin (procedures exist; UI tab not built).
4. **Per-page SEO meta tags** before any public promotion.
5. **Stripe/paywall** only after pricing confirmation and first real evidence corpus is established.
6. **Custom domain** purchasable in-app from Settings → Domains.
