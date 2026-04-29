# The Reno Record — State Report (as of 2026-04-29)

## 1. Build & Infra

| Layer | Tech | Status |
|---|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4 + shadcn/ui + wouter | Running, no LSP/TS errors |
| Backend | Node 22 + Express 4 + tRPC 11 + superjson | Running on port 3000 |
| DB | TiDB / MySQL via Drizzle ORM | Live; 10 tables; PRR status-history migration added |
| Auth | Manus OAuth, JWT session cookie | Wired; owner auto-promoted to `admin` |
| Storage | Manus S3 via `storagePut` (`/manus-storage/{key}`) | Wired; same-origin inline streaming proxy for evidence viewing |
| LLM | Manus Forge (Gemini 2.5 Flash) via `invokeLLM` | Wired (system + frontend keys injected) |
| Notifications | `notifyOwner()` server helper | Available; not yet bound to events |
| Tests | Vitest | 58/58 passing across 3 suites; `pnpm check`, `pnpm test`, and `pnpm build` passed after the public evidence-platform rewrite |
| Checkpoint | Generalized evidence intake, broader pattern dashboard, supporting-case reframing, and backend compatibility updates completed locally | **Ready for commit/push checkpoint** |
| Deploy | Manus built-in hosting | Not yet published; user clicks Publish in UI |

Live preview URL: `https://3000-ih9kzkycn4ncyvns0ryaf-91477af8.us1.manus.computer`

## 2. Database Schema (10 tables)

`users`, `stories`, `documents`, `timeline_events`, `actors` (with `judicial_actor` flag), `public_records_requests`, `agent_tasks` (Goblin advisory log), `chat_sessions`, `chat_messages`, `ingest_jobs` (auto-ingest pipeline state).

Migrations include the full Reno Record schema, chat/ingest/audit additions, and `0004_prr_status_history.sql`, which adds structured JSON history entries to `public_records_requests`.

## 3. Public Pages (all rendering)

Home now frames the project as a public corruption and misconduct evidence platform. The Church Record is a supporting documented case example rather than the product center. Rendering pages include Timeline as a cross-agency exposure chronology, Evidence Archive for source records and multimedia receipts, Submit Evidence as a generalized misconduct intake separating actors/evidence/patterns/timeline/publication safeguards, Public Records Tracker with per-request status history timelines, Actors index + detail for public actors and institutions, Election & Accountability, a broader Misconduct Pattern Dashboard, and Privacy.

## 4. Admin

Manus OAuth sign-in at `/admin`. Tabs: Goblin Ingest queue, Stories, Documents, Timeline, Actors, Public Records. Approve/reject/request-changes for stories and documents; CRUD for timeline / actors / PRRs; admin upload of evidence documents; PRR admin form now captures public status-history entries using `YYYY-MM-DD | status | note` lines.

## 5. Docket Goblin (AI assistant)

- Persistent floating chat bubble (admin-only) on every page.
- Grounded in archive context (stories, documents, timeline, actors, PRRs) on every send.
- Drop-zone in bubble: file → extract text → LLM-classify → draft title/summary/source-type/case-number/date/actors/tags plus structured actor extraction, evidence items, allegations, chronology, pattern signals, redaction risks, source quality, follow-up questions, public-records targets, and optional proposed timeline event → stage as **pending** document linked to the right story.
- Hard guarantee: never sets `publicStatus=true` and never sets `reviewStatus="approved"`. Admin-explicit approval is the only publication path.
- Tested: 4 dedicated tests covering RBAC + advisory-only + pending-on-ingest + admin-only approveIngest.

## 6. What's Weak / Unfinished / Missing

### Hard blockers before going public
1. **Upload security still needs a hardening pass** — the generalized public intake now captures better evidence metadata and publication safeguards, but the upload path still needs MIME allow-listing, magic-byte sniffing, size caps, and per-user rate limits before a public launch.
2. **Public submission is still anonymous** — the intake can preserve submitter privacy, but production launch should require authenticated submission or at least stronger anti-abuse controls.
3. **Checkpoint/push required** — the current evidence-platform rewrite should be committed and pushed before publication.

### Soft gaps (not blocking, real)
4. **Evidence Archive needs approved uploaded evidence to display records.** The online viewer now uses a same-origin streaming proxy and public document read procedures normalize persisted file URLs to `/manus-storage/*`, preventing stale CloudFront/S3 signed URLs from producing `AccessDenied` in inline viewers.
5. **Actor detail pages** render profile but don't yet aggregate related events / related documents.
6. **No CRUD UI in admin yet** for Stripe-style scoped CRUD on actors/timeline/PRRs (mutations exist; UI is partial).
7. **Per-page SEO meta tags** are generic; should be per-page (title/description/OG).
8. **No mobile QA pass** done.
9. **Public Records Tracker status history is implemented**; next polish could add document attachments and agency-response source links per status entry.

### Premium tier (v4, not started)
10. **Two-tier model (free public / paid Receipts)** — schema needs a `subscriber` role; Stripe integration needs to be added via `webdev_add_feature stripe`; pricing page; `<Paywall>` wrapper component; gated procedures.
11. Pricing decision pending: proposed $9/mo or $90/yr + $250 Founding Subscriber lifetime (capped at 100). Awaiting your confirmation.

## 7. Secrets & Keys

### Already injected (in env, no action needed)
| Name | Used for |
|---|---|
| `DATABASE_URL` | TiDB connection |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | Manus OAuth |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Auto-admin promotion |
| `BUILT_IN_FORGE_API_KEY` / `BUILT_IN_FORGE_API_URL` | Server-side LLM calls (Goblin chat + ingest) |
| `VITE_FRONTEND_FORGE_API_KEY` / `VITE_FRONTEND_FORGE_API_URL` | Frontend LLM (currently unused; server-side only) |
| `ELEVENLABS_API_KEY` | Available; unused so far |

### Missing — required for the next phases
| Name | Required for | Source |
|---|---|---|
| `STRIPE_SECRET_KEY` | Premium subscriptions (v4) | Stripe dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | Subscription lifecycle webhooks | Stripe dashboard → Webhooks |
| `STRIPE_PRICE_MONTHLY` | Price ID for $9/mo | Created in Stripe after pricing approval |
| `STRIPE_PRICE_YEARLY` | Price ID for $90/yr | Same |
| `STRIPE_PRICE_FOUNDING` | Price ID for $250 lifetime | Same |
| (optional) `RESEND_API_KEY` or similar | Subscriber receipts + new-receipt notifications | Resend / Postmark / etc. |

Note: the Manus platform offers a Stripe MCP, and `webdev_add_feature stripe` will scaffold the integration; you'll then provide the secret and price IDs through the secrets card without me ever seeing the values.

### Custom domain (optional but worth doing pre-launch)
The platform supports buying or binding a domain in-app. Suggest `therenorecord.com` or `renorecord.org`.

## 8. Tests

58/58 passing in three suites:
- `auth.logout.test.ts` — session clear behavior.
- `renoRecord.test.ts` — moderation gating, consent enforcement, admin-only RBAC, Docket Goblin advisory-only behavior, chat + ingest RBAC, no-auto-publish on ingest, admin-only approveIngest, PRR status-history create/update validation, and public evidence URL normalization to the same-origin storage proxy.
- `storageProxy.test.ts` — evidence files stream inline through `/manus-storage/*` and HEAD probes do not fall through to the SPA fallback.

## 9. Recommended Next Sequence

1. **Commit and push the public evidence-platform rewrite** to lock the generalized intake, broader public pages, and backend compatibility updates.
2. **Finish upload security + auth-gated submissions** with MIME allow-listing, magic-byte sniffing, size caps, rate limits, and abuse controls.
3. **Add Stripe/paywall only if the premium receipts tier is still desired** — this needs pricing confirmation and Stripe keys.
4. **Custom domain + per-page SEO + first real evidence uploads** before going public.
5. **Publish after the hardening pass.**


## Public evidence-platform rewrite completed locally

The public framing has now moved beyond a single case archive. The Church Record remains as a documented supporting example, while the broader product is positioned as a Reno/Washoe public corruption evidence platform. The main public surfaces now emphasize cross-agency misconduct patterns, actor and institution dossiers, source evidence, public-records pressure, exposure timelines, and review-safe publication. The public Submit Evidence workflow has been redesigned into a structured intake that separates involved actors, agencies, evidence types, date ranges, pattern signals, records-request status, publication permissions, privacy needs, and follow-up contact preferences. The backend accepts the new generalized intake fields while preserving legacy story submission compatibility and existing tests. Verification completed successfully with `pnpm check`, `pnpm test`, and `pnpm build`.
