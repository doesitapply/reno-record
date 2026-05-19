/**
 * The Reno Record — Stripe Product & Price Definitions
 *
 * Tiers:
 *   free          — browse only, 3 free Goblin uses lifetime
 *   receipts      — full archive + PDF viewer + unlimited exports ($9/mo)
 *   goblin_pro    — receipts + Docket Goblin 200 credits/mo ($29/mo)
 *   founding      — lifetime Receipts ($250 one-time)
 *   founders_circle — lifetime Goblin Pro ($500 one-time)
 *
 * Credit packs (add-on for any tier):
 *   100 credits  — $5
 *   500 credits  — $20
 *   2500 credits — $75
 */

export type TierSlug = "free" | "receipts" | "goblin_pro" | "founding" | "founders_circle";

export interface TierDef {
  slug: TierSlug;
  label: string;
  description: string;
  priceMonthly: number | null;   // cents, null = one-time
  priceOneTime: number | null;   // cents, null = recurring
  goblinCreditsPerMonth: number; // 0 = none
  features: string[];
  highlighted: boolean;
  stripePriceId?: string;        // set after creating in Stripe dashboard
}

export const TIERS: TierDef[] = [
  {
    slug: "free",
    label: "Free",
    description: "Browse the public archive. See what's on record.",
    priceMonthly: 0,
    priceOneTime: null,
    goblinCreditsPerMonth: 0,
    features: [
      "Full public archive access",
      "Search and filter documents",
      "3 Docket Goblin uses (lifetime)",
      "5 PDF exports per month",
    ],
    highlighted: false,
  },
  {
    slug: "receipts",
    label: "Receipts",
    description: "Full access. Every document, every pattern, unlimited exports.",
    priceMonthly: 900,
    priceOneTime: null,
    goblinCreditsPerMonth: 0,
    features: [
      "Everything in Free",
      "Full inline PDF viewer",
      "Unlimited exports",
      "Actor dossier deep-links",
      "Agency violation heat maps",
      "Early access to new features",
    ],
    highlighted: false,
  },
  {
    slug: "goblin_pro",
    label: "Goblin Pro",
    description: "The full weapon. Receipts + AI-powered document analysis.",
    priceMonthly: 2900,
    priceOneTime: null,
    goblinCreditsPerMonth: 200,
    features: [
      "Everything in Receipts",
      "200 Docket Goblin credits/month",
      "Auto-extract actors, violations, timeline",
      "Structured violation tag output",
      "Source-quoted evidence chains",
      "Priority processing queue",
    ],
    highlighted: true,
  },
  {
    slug: "founding",
    label: "Founding Member",
    description: "Lifetime Receipts. One payment. Permanent access.",
    priceMonthly: null,
    priceOneTime: 25000,
    goblinCreditsPerMonth: 0,
    features: [
      "Lifetime Receipts access",
      "Founding Member badge",
      "Name in the archive credits",
      "No recurring charges ever",
    ],
    highlighted: false,
  },
  {
    slug: "founders_circle",
    label: "Founder's Circle",
    description: "Lifetime Goblin Pro. For operators who are serious.",
    priceMonthly: null,
    priceOneTime: 50000,
    goblinCreditsPerMonth: 200,
    features: [
      "Lifetime Goblin Pro access",
      "200 credits/month forever",
      "Founder's Circle badge",
      "Direct operator access",
      "Name in the archive credits",
    ],
    highlighted: false,
  },
];

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  price: number; // cents
  stripePriceId?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_100", label: "100 Credits", credits: 100, price: 500 },
  { id: "pack_500", label: "500 Credits", credits: 500, price: 2000 },
  { id: "pack_2500", label: "2,500 Credits", credits: 2500, price: 7500 },
];

/** XP points awarded per action */
export const XP_TABLE: Record<string, number> = {
  document_submitted: 10,
  document_verified: 50,
  violation_tag_confirmed: 20,
  first_on_record: 100,
  pattern_unlock: 75,
  daily_return: 5,
  actor_linked: 15,
  agency_linked: 15,
};

/** Goblin credit cost per operation */
export const GOBLIN_COSTS = {
  ingest: 10,      // full PDF ingest + classification
  chat: 1,         // single chat message
} as const;

/** Free tier limits */
export const FREE_LIMITS = {
  goblinLifetime: 3,
  pdfExportsPerMonth: 5,
} as const;
