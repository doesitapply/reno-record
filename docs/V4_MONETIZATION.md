# The Reno Record — v4 Monetization Plan (Spec Only)

**Status:** Draft for review. No Stripe code is implemented yet. This document defines the product, data, billing, gating, and risk model so the next coding pass can begin only after sign-off.

**Author:** Cameron / Manus AI build agent
**Last revised:** 2026-04-25
**Hard constraints carried forward from v1–v3.5:**

1. No public auto-publishing of any submitted content. Admin approval is mandatory.
2. The AI assistant is named **Docket Goblin** and is advisory only.
3. The Election & Accountability page must remain neutral and sourced only from public records.
4. Documents flagged `no_ai_processing` are never readable by Docket Goblin under any tier.
5. SMTP is fail-safe: missing env never throws; the system logs `email_skipped` and continues.

---

## 1. Product structure

The Reno Record splits into a **public accountability layer** (free, drives reach and credibility) and a **paid Receipts layer** (drives revenue and funds the public layer).

| Tier | Audience | Price | What's included |
|---|---|---|---|
| **Public** (free) | General readers, journalists, voters | $0 | Home, The Church Record narrative, Timeline, neutral Election page, Pattern Dashboard (aggregate counts only), redacted document previews, Public Records Tracker |
| **Receipts** (paid, monthly) | Researchers, attorneys, civic accountability subscribers | **$9 / month** | Public tier plus: full unredacted Evidence Archive (where visibility is `receipts_only` or `public_preview`), full inline PDF viewer, document text excerpts, actor dossier deep links, full Timeline source-document linkage, weekly Receipts briefing email |
| **Receipts (annual)** | Same as monthly | **$90 / year** | Same as monthly with 17% discount and an annual "year in records" digest |
| **Goblin Pro** (paid, monthly) | Power users, fellow operators researching their own cases | **$29 / month** | Receipts plus: ability to chat with Docket Goblin against the public archive, ability to ingest and auto-structure their **own** uploaded documents, 200 Goblin credits / month, priority queue |
| **Founding Subscriber** (paid, lifetime) | Early supporters | **$250 one-time, capped at 100 sales** | Lifetime Receipts access, "Founding Subscriber" badge in any future commenting features, name on a public donor wall (opt-in), included in every annual digest |
| **Founder's Circle** (paid, lifetime, premium) | Operators who want Goblin Pro forever | **$500 one-time, capped at 50 sales** | Lifetime Receipts + lifetime Goblin Pro, 500 credits/month forever |
| **Credit packs** (one-time, non-subscription) | Anyone who needs a burst of Goblin processing without subscribing | **$5 / 100 credits**, **$20 / 500 credits**, **$75 / 2,500 credits** | Credits are consumed by Goblin ingest jobs and bulk export jobs. Never expire. |

Pricing is the working hypothesis. Adjustments are cheap because everything is mapped to Stripe Price IDs in env, not in code.

### 1.1 What "Receipts only" actually unlocks

Documents in v3 already have a 7-state `documentVisibility` enum. The paywall hooks into exactly two of those states without changing the schema:

- `public_preview` — visible to all (free + paid). Shows full content. This is the marketing surface.
- `receipts_only` — visible to authenticated subscribers (Receipts or higher). Shows full content. This is the paywall surface.
- `pending_review`, `needs_redaction`, `private_admin_only`, `goblin_allowed`, `rejected` — never public regardless of tier.

This means **paywall enforcement is one boolean check at procedure level**: `isReceiptsActive(user) || visibility === "public_preview"`. No new visibility states required.

---

## 2. Database changes

Three additive tables and three additive columns. Nothing existing changes shape, so v3.5 stays compatible.

### 2.1 New tables

```sql
-- Subscription lifecycle, sourced from Stripe webhooks. user.id is the join key.
CREATE TABLE subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  stripe_customer_id    VARCHAR(64),
  stripe_subscription_id VARCHAR(64) UNIQUE,
  product_key     ENUM('receipts_monthly','receipts_annual','goblin_pro_monthly',
                       'founding_lifetime','founders_circle_lifetime') NOT NULL,
  status          ENUM('active','trialing','past_due','canceled','unpaid','incomplete') NOT NULL,
  current_period_end TIMESTAMP NULL,
  cancel_at       TIMESTAMP NULL,
  is_lifetime     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (status)
);

-- Credit ledger. Append-only. Balance = SUM(amount). Never updated, only inserted.
CREATE TABLE credit_ledger (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  amount          INT NOT NULL,                  -- positive = grant, negative = consume
  reason          ENUM('purchase','subscription_grant','goblin_ingest',
                       'goblin_chat','export_job','manual_grant','refund') NOT NULL,
  stripe_payment_intent_id VARCHAR(64),
  related_target_type VARCHAR(32),
  related_target_id   INT,
  metadata        JSON,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, created_at)
);

-- Stripe webhook event log. Idempotency table.
CREATE TABLE stripe_events (
  id              VARCHAR(64) PRIMARY KEY,        -- Stripe event id
  type            VARCHAR(64) NOT NULL,
  payload         JSON NOT NULL,
  processed_at    TIMESTAMP NULL,
  error           TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (type)
);
```

### 2.2 New columns

| Table | Column | Type | Purpose |
|---|---|---|---|
| `users` | `stripe_customer_id` | varchar(64) | Cache of Stripe customer id; not authoritative — `subscriptions` is authoritative |
| `users` | `tier` | enum('free','receipts','goblin_pro','founding','founders_circle') default 'free' | **Denormalized cache** of effective tier. Recomputed on every webhook write. Read on every paywall check. |
| `documents` | `monetization_tag` | enum('default','premium_only','always_free') default 'default' | Manual override knob. `premium_only` forces a `public_preview` doc behind the paywall (rare); `always_free` forces a `receipts_only` doc into the free tier (when we want a marketing teaser). 99% of decisions stay on `documentVisibility`. |

The `tier` cache exists because we will gate hundreds of procedures and don't want to join `subscriptions` on every read. It is rebuilt only inside `writeStripeEvent()` so it can never drift unless we manually corrupt it.

---

## 3. Stripe product mapping

Stripe products and prices are managed in **Stripe Dashboard**, not in code. The application reads only **Price IDs** from env. This is deliberate — it means a price change is a one-line env update, not a deploy.

| Internal `product_key` | Stripe product | Stripe price | Env variable |
|---|---|---|---|
| `receipts_monthly` | "Receipts — monthly" | $9.00 / month, recurring | `STRIPE_PRICE_RECEIPTS_MONTHLY` |
| `receipts_annual` | "Receipts — annual" | $90.00 / year, recurring | `STRIPE_PRICE_RECEIPTS_ANNUAL` |
| `goblin_pro_monthly` | "Goblin Pro — monthly" | $29.00 / month, recurring | `STRIPE_PRICE_GOBLIN_PRO_MONTHLY` |
| `founding_lifetime` | "Founding Subscriber (Lifetime)" | $250.00 one-time | `STRIPE_PRICE_FOUNDING_LIFETIME` |
| `founders_circle_lifetime` | "Founder's Circle (Lifetime)" | $500.00 one-time | `STRIPE_PRICE_FOUNDERS_CIRCLE_LIFETIME` |
| `credit_pack_100` | "Credits — 100 pack" | $5.00 one-time | `STRIPE_PRICE_CREDITS_100` |
| `credit_pack_500` | "Credits — 500 pack" | $20.00 one-time | `STRIPE_PRICE_CREDITS_500` |
| `credit_pack_2500` | "Credits — 2500 pack" | $75.00 one-time | `STRIPE_PRICE_CREDITS_2500` |

Founding tiers use Stripe's invoice/quantity-cap pattern: the product is published with a metadata flag `cap=100`. The webhook handler increments a counter in `stripe_events` aggregate; if the cap is hit, the checkout session creator returns 410 Gone for that price.

---

## 4. Webhooks

We only listen to the events we actually act on. Everything else is logged-only.

| Event | Action |
|---|---|
| `customer.created` | Cache `stripe_customer_id` on the matching user |
| `checkout.session.completed` (recurring) | Insert `subscriptions` row, set `users.tier` |
| `checkout.session.completed` (one-time, lifetime) | Insert `subscriptions` row with `is_lifetime=true`, set `users.tier`, increment founding-cap counter |
| `checkout.session.completed` (one-time, credit pack) | Insert positive `credit_ledger` entry with `reason='purchase'` |
| `customer.subscription.updated` | Update `subscriptions.status`, `current_period_end`, recompute `users.tier` |
| `customer.subscription.deleted` | Mark `subscriptions.status='canceled'`, recompute `users.tier` (drops to `free` unless they have a lifetime sub) |
| `invoice.payment_failed` | Status → `past_due`, recompute tier; tier becomes `free` after 7-day grace (cron job) |
| `charge.refunded` | If credit pack: insert negative `credit_ledger` entry with `reason='refund'`. If subscription: handled by `customer.subscription.updated`. |

**Idempotency:** every webhook is deduped against `stripe_events.id`. If the row already exists with `processed_at` set, the handler returns 200 immediately without re-processing.

**Webhook signature verification** uses Stripe's official `constructEvent` with `STRIPE_WEBHOOK_SECRET`. No event is processed without a valid signature.

**Endpoint:** `POST /api/stripe/webhook`. Raw-body parsed (Express raw middleware), bypasses tRPC entirely, lives in `server/_core/index.ts` next to OAuth callbacks.

---

## 5. Server-side gating plan

There is exactly **one** gating helper. Everything else calls it. This is the security boundary.

```ts
// server/_billing.ts (planned)
export type EffectiveTier = "free" | "receipts" | "goblin_pro" | "founding" | "founders_circle";

export function tierRanksAtLeast(t: EffectiveTier, min: EffectiveTier): boolean { ... }

export async function requireTier(ctx: TrpcContext, min: EffectiveTier): Promise<void> {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!tierRanksAtLeast(ctx.user.tier as EffectiveTier, min)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Subscription required" });
  }
}
```

### 5.1 Procedure-level gating allowlist

All gated procedures are listed here for review. Anything not on this list is free.

| Procedure | Required tier | Notes |
|---|---|---|
| `document.publicGet` | free if visibility=public_preview, else `receipts` | Branches on document |
| `document.publicSearch` | free | Returns receipts-only docs as **redacted previews only** for free users |
| `document.fullText` | `receipts` | Full extracted text |
| `document.exportPdf` | `receipts` (1 credit), `goblin_pro` free | Credit decrement on `receipts` |
| `timeline.public` | free | Always free; source links 410 for free if doc is receipts_only |
| `timeline.linkedDocument(id)` | free or `receipts` | Branches on linked document's visibility |
| `actors.dossier(slug)` | free | Free actor profile, basic facts |
| `actors.fullDossier(slug)` | `receipts` | All linked filings, all timeline events with source docs |
| `goblin.chat` | `goblin_pro` (or `founding`/`founders_circle` if owned) | 1 credit / message |
| `goblin.ingestOwn` | `goblin_pro` | User's own uploaded docs; 5 credits / doc; never auto-publishes to public archive |
| `goblin.bulkExport` | `goblin_pro` | 50 credits / job |
| Everything else | free | Submit, sign-up, audit log (admin), public PRR tracker, election page |

### 5.2 Frontend defense in depth

The server is the security boundary. The client also hides paywalled content behind a `<Paywall>` component so that **even if the server forgets to check, the user sees the upsell card** and never the content. This is belt-and-suspenders, not a substitute for the server check.

---

## 6. Paywall component plan

```tsx
// client/src/components/Paywall.tsx (planned)
<Paywall requires="receipts" preview={<RedactedPdfPreview doc={doc} />}>
  <FullPdfViewer doc={doc} />
</Paywall>
```

Behavior:

- If user's tier already meets `requires`, render children.
- If not signed in, render the preview + a "Sign in to subscribe" CTA that uses `getLoginUrl(returnPath)` so they come back to this exact URL after auth.
- If signed in but on a lower tier, render the preview + a single primary CTA "Subscribe — $9/month" that opens a Stripe Checkout session for `STRIPE_PRICE_RECEIPTS_MONTHLY` with `success_url=window.location.href` and `cancel_url=window.location.href`.
- The preview prop is **mandatory**. We never render an empty paywall — that's a bad reading experience and bad SEO.
- For documents specifically, the preview is a redacted thumbnail and the first page of the PDF only.

Variants:

- `<Paywall.Inline>` — single document or section
- `<Paywall.PageGate>` — full-page gate (used for "Full Receipts archive" landing page)
- `<Paywall.SidebarUpsell>` — persistent sidebar widget on the public site for free readers

---

## 7. Credit deduction plan

Credits are an append-only ledger. **Balance is computed, never stored.**

```ts
// server/_credits.ts (planned)
export async function getBalance(userId: number): Promise<number> {
  const r = await db.execute(
    sql`SELECT COALESCE(SUM(amount),0) AS bal FROM credit_ledger WHERE user_id=${userId}`
  );
  return Number(r[0]?.bal ?? 0);
}

export async function debitCredits(opts: {
  userId: number;
  amount: number;          // positive integer
  reason: CreditReason;
  relatedTargetType?: string;
  relatedTargetId?: number;
}): Promise<{ ok: true; newBalance: number } | { ok: false; reason: "insufficient" }> {
  // 1) Read balance under transaction
  // 2) If balance < amount → return { ok: false, reason: 'insufficient' }
  // 3) Insert row with amount = -amount
  // 4) Return new balance
}
```

Subscription monthly credit grants happen in the `customer.subscription.updated` webhook (when `current_period_end` rolls forward), as a positive ledger entry with `reason='subscription_grant'`. Goblin Pro subscribers get 200 credits/month; lifetime Founder's Circle gets 500/month forever. Subscription-granted credits **do not stack indefinitely** — we cap rollover at 3 months' worth via a monthly cron job that inserts a negative ledger entry capping the balance.

Per-action costs (working hypothesis, easily tunable in env):

| Action | Cost | Notes |
|---|---|---|
| Goblin chat message | 1 credit | Costs more for very long context calls — cost is computed from input tokens |
| Goblin ingest of own document | 5 credits | Includes extract + classify + draft tags + draft summary |
| Bulk export job (PDF zip) | 50 credits | Plus 1 credit per document in the zip |
| `document.exportPdf` for Receipts subscribers | 1 credit | Goblin Pro and lifetime tiers free |

Every debit creates an audit log entry under `action='credit_debited'` (new audit enum value — requires a migration). Non-negotiable. We need a paper trail for every charged operation.

---

## 8. Export job billing plan

Bulk exports are slow and expensive (PDF rendering, S3 streaming, large bandwidth). They are gated and metered.

Flow:

1. User clicks "Export this case" on a story page.
2. Frontend calls `export.estimate({ storyId })` → returns `{ docs: 27, credits_required: 77 }` (50 base + 27 docs).
3. Frontend shows a confirmation modal: "This will use 77 credits. You have 200. Proceed?"
4. On confirm, `export.start({ storyId })` debits credits **before** queuing the job. If debit fails, no job is queued.
5. Job runs server-side, writes to S3, emails the user a download link via `emailExportReady()`.
6. If the job fails server-side, credits are refunded with an audit entry `reason='refund'`.

**No export is queued without a successful pre-debit.** No exceptions.

---

## 9. Security risks and mitigations

| Risk | Mitigation |
|---|---|
| **Webhook replay attack** | Stripe signature verification + idempotency table |
| **Webhook spoofing** | `STRIPE_WEBHOOK_SECRET` rotation procedure documented in operator-secrets skill |
| **Race condition: user calls Goblin chat 50x in 50ms with 1 credit balance** | Debit in serializable transaction with `SELECT ... FOR UPDATE` on the user row OR optimistic check-then-insert with row-level lock; reject when balance would go negative |
| **Subscription downgrade leaves cached `users.tier=receipts` stale** | `users.tier` is **always** recomputed inside the webhook handler from authoritative `subscriptions` rows, never written from any other path |
| **User cancels mid-period** | Status becomes `canceled` but `current_period_end` is in the future. Tier stays `receipts` until `current_period_end`, then a cron job recomputes |
| **Founding cap race condition (101st sale gets through)** | Use Stripe Checkout `inventory.type=finite` + atomic counter check inside webhook with idempotency. Worst case: refund the 101st with apology email |
| **Credit ledger double-debit** | Append-only inserts under transaction; UNIQUE composite index `(user_id, related_target_type, related_target_id, reason)` for actions where double-debit would be a bug (ingest job id, export job id) |
| **Frontend forgets to gate; public scraper hits the API directly** | Server `requireTier()` is the boundary, not the UI |
| **Refund on a subscription that was already used** | Refunds via `charge.refunded` are honored; subscription status flips immediately. Used credits are **not** clawed back (intentional). Future `manual_grant` audit entry can override if needed |
| **PII in Stripe metadata** | Never write user content to Stripe metadata. Only `user_id`, `product_key`, `internal_session_id` |
| **Test mode keys in production** | Env validator on boot refuses to start the server if `STRIPE_SECRET_KEY` starts with `sk_test_` while `NODE_ENV=production` |

---

## 10. Open questions before implementation

These are the actual unknowns that need a decision from the operator (Cameron) before code is written. Order matters — questions higher in the list block more downstream work.

1. **Pricing confirmation.** Are the working numbers ($9/mo, $90/yr, $29 Goblin Pro, $250 Founding cap 100, $500 Founder's Circle cap 50) the launch numbers? If not, what overrides? *(Mid-launch price changes are cheap because Stripe Price IDs are env-mounted, but the launch number sets all marketing copy.)*
2. **Tax handling.** Use Stripe Tax for automatic sales tax / VAT, or stay manual / inclusive pricing? Stripe Tax adds ~0.5% but removes legal risk in EU/UK.
3. **Free trial length.** None / 7 days / 14 days for Receipts? Trials reduce conversion friction but require trial-aware webhook handling.
4. **Refund policy public copy.** Default is "no refunds, cancel anytime, access continues until period end." Need your sign-off on this exact phrasing for the Pricing page.
5. **Founding wall opt-in.** Should the Founding Subscriber donor wall display real names by default with opt-out, or be opt-in only? *(My recommendation: opt-in only. Privacy is the default for an accountability site.)*
6. **Annual digest cadence.** Calendar year (Jan 1 → Dec 31) or anniversary year (subscriber join date)? *(Anniversary is friendlier to retention; calendar is simpler to publish.)*
7. **Goblin Pro and self-uploaded docs — public risk.** A Goblin Pro user uploads their own divorce decree to be auto-structured. This must be **strictly siloed** from the public archive. Confirm: self-uploaded docs default to `private_admin_only` and `no_ai_processing`, and the only AI processing happens because they are already private to that user, *not* because Goblin has been granted a global read flag. Need explicit sign-off on this isolation model.
8. **Credit pack pricing realism.** $5 / 100 credits assumes ~$0.05 per Goblin chat message. Real Forge LLM cost per chat is closer to ~$0.005, so margin is healthy. Are credit prices fine, or should they be lower to encourage usage?
9. **Receipts feed API.** Some subscribers may want an API key to pull the Receipts archive into their own tooling. Build this in v4 or defer to v5? *(My recommendation: defer. API is a separate revenue stream and surface-area risk.)*
10. **Founding sale cap enforcement under load.** Acceptable to over-sell by 1–2 with auto-refund, or hard-stop at 100 even under concurrent traffic? *(Hard-stop is more work; over-sell-and-refund is shipped in 30 minutes.)*
11. **Email frequency for paid tiers.** Weekly Receipts briefing — opt-out by default, or opt-in? CAN-SPAM compliance requires unsubscribe regardless.
12. **Anonymous / Bitcoin payments.** Stripe only, or also accept BTC for users who explicitly want untraceable accountability subscriptions? *(My recommendation: Stripe only at launch. BTC is a v5+ conversation.)*

---

## 11. Build order (after sign-off)

This is the v4 implementation sequence I will execute once questions above are answered. Estimates assume current build velocity and 41/41 test baseline.

1. **Schema + migration** — `subscriptions`, `credit_ledger`, `stripe_events` tables; `users.stripe_customer_id`, `users.tier`, `documents.monetization_tag` columns. (~30 min)
2. **`server/_billing.ts`** — `requireTier()`, `tierRanksAtLeast()`, tier recomputation function. (~30 min)
3. **`server/_credits.ts`** — balance, debit, transactional safety. (~45 min)
4. **Stripe SDK + checkout session creator** — `POST /api/stripe/checkout` for each product. (~45 min)
5. **`POST /api/stripe/webhook`** — signature verify, idempotency, dispatch table. (~90 min)
6. **`<Paywall>` component + Pricing page + Account/Billing page (Customer Portal link).** (~90 min)
7. **Apply `requireTier()` to every procedure on the gating allowlist (Section 5.1).** (~60 min)
8. **Credit deduction on Goblin chat / ingest / export.** (~60 min)
9. **Tests:** webhook idempotency, signature rejection, gating per tier, credit insufficient, cap enforcement, downgrade-on-cancel, race-condition simulation. (~90 min)
10. **Founding cap dashboard + manual override.** (~30 min)
11. **End-to-end manual test against Stripe test mode + checkpoint.** (~45 min)

**Total: ~9 hours of focused build time** before public launch of paid tiers. Add ~2 hours of marketing copy and pricing-page polish.

---

## 12. What this plan deliberately does not do

To stay shippable, v4 explicitly defers:

- Team / multi-seat plans (legal firm subscriptions). v5.
- Comments / discussion features for paid tiers. v5+.
- API keys for programmatic Receipts access. v5+.
- Affiliate / referral revenue share. v5+.
- BTC / crypto payments. v5+.
- Donations (separate from subscription). Could fold into v4 as a Stripe one-time product if you want — flag it in question #12.
- Mobile app. Web-first launch.

---

## 13. Approval checklist

Before any v4 code is written:

- [ ] Pricing confirmed (Q1)
- [ ] Tax decision made (Q2)
- [ ] Trial decision made (Q3)
- [ ] Refund copy approved (Q4)
- [ ] Founding wall consent model approved (Q5)
- [ ] Goblin Pro self-upload isolation model approved (Q7)
- [ ] Credit pricing approved (Q8)
- [ ] Founding cap enforcement strategy chosen (Q10)
- [ ] Stripe account ready (live + test mode keys, webhook endpoint provisioned)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and all `STRIPE_PRICE_*` env values provided

Once those are checked, I begin Section 11 in order. No Stripe code touches the repo before that.

— end of v4 spec —
