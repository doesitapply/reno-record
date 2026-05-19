/**
 * Stripe checkout session helpers.
 * Called from tRPC procedures — never directly from the client.
 */

import Stripe from "stripe";
import { TIERS, CREDIT_PACKS, type TierSlug } from "./products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

interface CreateSubscriptionSessionInput {
  userId: number;
  userEmail: string;
  userName: string;
  tierSlug: TierSlug;
  origin: string; // window.location.origin from frontend
}

interface CreateCreditPackSessionInput {
  userId: number;
  userEmail: string;
  userName: string;
  packId: string;
  origin: string;
}

export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionSessionInput
): Promise<string> {
  const tier = TIERS.find((t) => t.slug === input.tierSlug);
  if (!tier) throw new Error(`Unknown tier: ${input.tierSlug}`);

  const isOneTime = tier.priceOneTime !== null;
  const amount = isOneTime ? tier.priceOneTime! : tier.priceMonthly!;

  if (amount === 0) throw new Error("Cannot create checkout for free tier");

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: isOneTime ? "payment" : "subscription",
    customer_email: input.userEmail,
    client_reference_id: input.userId.toString(),
    allow_promotion_codes: true,
    metadata: {
      user_id: input.userId.toString(),
      customer_email: input.userEmail,
      customer_name: input.userName,
      tier_slug: input.tierSlug,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `The Reno Record — ${tier.label}`,
            description: tier.description,
          },
          ...(isOneTime
            ? { unit_amount: amount }
            : {
                unit_amount: amount,
                recurring: { interval: "month" },
              }),
        },
        quantity: 1,
      },
    ],
    success_url: `${input.origin}/billing?success=1&tier=${input.tierSlug}`,
    cancel_url: `${input.origin}/pricing?cancelled=1`,
  };

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session.url!;
}

export async function createCreditPackCheckoutSession(
  input: CreateCreditPackSessionInput
): Promise<string> {
  const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
  if (!pack) throw new Error(`Unknown credit pack: ${input.packId}`);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.userEmail,
    client_reference_id: input.userId.toString(),
    allow_promotion_codes: true,
    metadata: {
      user_id: input.userId.toString(),
      customer_email: input.userEmail,
      customer_name: input.userName,
      pack_id: input.packId,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `The Reno Record — ${pack.label}`,
            description: `${pack.credits} Docket Goblin credits`,
          },
          unit_amount: pack.price,
        },
        quantity: 1,
      },
    ],
    success_url: `${input.origin}/billing?success=1&pack=${input.packId}`,
    cancel_url: `${input.origin}/pricing?cancelled=1`,
  });

  return session.url!;
}

export async function getCustomerPortalUrl(
  stripeCustomerId: string,
  origin: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${origin}/billing`,
  });
  return session.url;
}
