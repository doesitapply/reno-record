/**
 * Subscription gating helpers.
 * All checks operate on the user row from the DB — no Stripe API calls at
 * request time, keeping latency low.
 */

import type { User } from "../../drizzle/schema";

type TierSlug = "free" | "receipts" | "goblin_pro" | "founding" | "founders_circle";

const TIER_RANK: Record<TierSlug, number> = {
  free: 0,
  receipts: 1,
  goblin_pro: 2,
  founding: 3,
  founders_circle: 4,
};

/** Returns true if the user's subscription tier is at or above the required tier
 *  AND the subscription is in an active/trialing state (or is a lifetime tier). */
export function hasTier(user: User, required: TierSlug): boolean {
  const tier = (user.subscriptionTier ?? "free") as TierSlug;
  const status = user.subscriptionStatus ?? "none";
  const rank = TIER_RANK[tier] ?? 0;
  const requiredRank = TIER_RANK[required];

  // Lifetime tiers are always active regardless of status
  if (tier === "founding" || tier === "founders_circle") return rank >= requiredRank;

  // Recurring tiers require active or trialing status
  const isActive = status === "active" || status === "trialing";
  return isActive && rank >= requiredRank;
}

/** Can the user view full PDF / download without limit? */
export function isReceiptsActive(user: User): boolean {
  return hasTier(user, "receipts");
}

/** Can the user use Docket Goblin? */
export function isGoblinProActive(user: User): boolean {
  return hasTier(user, "goblin_pro");
}

/** Does the user have enough Goblin credits for an operation? */
export function hasGoblinCredits(user: User, cost: number): boolean {
  // Goblin Pro subscription users get monthly credits
  if (isGoblinProActive(user)) {
    return (user.goblinCredits ?? 0) >= cost;
  }
  // Free tier gets 3 lifetime uses
  return (user.goblinFreeUsed ?? 0) < 3;
}

/** How many free Goblin uses remain? */
export function freeGoblinRemaining(user: User): number {
  return Math.max(0, 3 - (user.goblinFreeUsed ?? 0));
}

/** Tier display label */
export function tierLabel(tier: TierSlug | string): string {
  const labels: Record<string, string> = {
    free: "Free",
    receipts: "Receipts",
    goblin_pro: "Goblin Pro",
    founding: "Founding Member",
    founders_circle: "Founder's Circle",
  };
  return labels[tier] ?? "Free";
}
