/**
 * Stripe webhook handler.
 * Mount at /api/stripe/webhook with express.raw({ type: 'application/json' })
 * BEFORE express.json() middleware.
 */

import type { Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { users, creditLedger } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { CREDIT_PACKS, TIERS } from "./products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Test events — return immediately for webhook verification
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] ${event.type} ${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(sub);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, err);
    return res.status(500).json({ error: "Handler failed" });
  }

  return res.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) return;

  const userId = parseInt(session.metadata?.user_id ?? session.client_reference_id ?? "0");
  if (!userId) return;

  const customerId = session.customer as string;
  const tierSlug = session.metadata?.tier_slug as string | undefined;
  const packId = session.metadata?.pack_id as string | undefined;

  if (packId) {
    // Credit pack purchase
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (pack) {
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, userId));

      await db.insert(creditLedger).values({
        userId,
        delta: pack.credits,
        reason: "credit_pack_purchase",
        stripePaymentIntentId: session.payment_intent as string,
        metadata: { packId, credits: pack.credits },
      });

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({ goblinCredits: (user.goblinCredits ?? 0) + pack.credits })
          .where(eq(users.id, userId));
      }
    }
    return;
  }

  if (tierSlug === "founding" || tierSlug === "founders_circle") {
    // Lifetime one-time purchase
    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        subscriptionTier: tierSlug as any,
        subscriptionStatus: "active",
      })
      .where(eq(users.id, userId));
    return;
  }

  // Recurring subscription — update customer ID
  if (customerId) {
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId));
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = sub.customer as string;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user) return;

  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "cancelled",
    incomplete: "none",
    incomplete_expired: "none",
    unpaid: "past_due",
    paused: "cancelled",
  };

  const status = statusMap[sub.status] ?? "none";
  const priceId = sub.items.data[0]?.price?.id;
  const tierMeta = sub.metadata?.tier_slug;
  let tier = tierMeta ?? "free";

  if (!tierMeta && priceId) {
    const matchedTier = TIERS.find((t) => t.stripePriceId === priceId);
    if (matchedTier) tier = matchedTier.slug;
  }

  await db
    .update(users)
    .set({
      stripeSubscriptionId: sub.id,
      subscriptionTier: tier as any,
      subscriptionStatus: status as any,
    })
    .where(eq(users.id, user.id));
}

async function handleSubscriptionCancelled(sub: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = sub.customer as string;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user) return;

  await db
    .update(users)
    .set({
      subscriptionTier: "free",
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: null,
    })
    .where(eq(users.id, user.id));
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const customerId = invoice.customer as string;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user) return;

  const tier = user.subscriptionTier;
  if (tier === "goblin_pro") {
    const tierDef = TIERS.find((t) => t.slug === "goblin_pro");
    const monthlyCredits = tierDef?.goblinCreditsPerMonth ?? 200;

    await db
      .update(users)
      .set({
        goblinCredits: (user.goblinCredits ?? 0) + monthlyCredits,
        goblinUsedThisMonth: 0,
        subscriptionStatus: "active",
      })
      .where(eq(users.id, user.id));

    const paymentIntentId = typeof (invoice as any).payment_intent === "string"
      ? (invoice as any).payment_intent as string
      : ((invoice as any).payment_intent as any)?.id ?? null;

    await db.insert(creditLedger).values({
      userId: user.id,
      delta: monthlyCredits,
      reason: "subscription_monthly",
      stripePaymentIntentId: paymentIntentId,
      metadata: { tier, monthlyCredits },
    });
  }
}
