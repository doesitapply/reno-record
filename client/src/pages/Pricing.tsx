import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Zap, Shield, Star, Crown, BookOpen } from "lucide-react";

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <BookOpen className="w-5 h-5" />,
  receipts: <Shield className="w-5 h-5" />,
  goblin_pro: <Zap className="w-5 h-5" />,
  founding: <Star className="w-5 h-5" />,
  founders_circle: <Crown className="w-5 h-5" />,
};

export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const { data: tiers } = trpc.billing.tiers.useQuery();
  const { data: creditPacks } = trpc.billing.creditPacks.useQuery();
  const { data: sub } = trpc.billing.mySubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setLoadingTier(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setLoadingTier(null);
    },
  });

  const createPackCheckout = trpc.billing.createCreditPackCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleTierClick(tierSlug: string) {
    if (tierSlug === "free") return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    setLoadingTier(tierSlug);
    createCheckout.mutate({
      tierSlug: tierSlug as any,
      origin: window.location.origin,
    });
  }

  function handlePackClick(packId: string) {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    createPackCheckout.mutate({ packId, origin: window.location.origin });
  }

  const currentTier = sub?.tier ?? "free";

  return (
    <SiteShell>
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Access the Record
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The archive is free to browse. Deeper access, AI-powered analysis, and the ability to
            contribute to the record require a membership.
          </p>
          <p className="text-xs text-muted-foreground mt-3 font-mono">
            Test card: 4242 4242 4242 4242 · any future date · any CVC
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {(tiers ?? []).map((tier) => {
            const isCurrent = currentTier === tier.slug;
            const isHighlighted = tier.highlighted;
            const price =
              tier.priceMonthly !== null
                ? tier.priceMonthly === 0
                  ? "Free"
                  : `$${(tier.priceMonthly / 100).toFixed(0)}/mo`
                : `$${((tier.priceOneTime ?? 0) / 100).toFixed(0)} one-time`;

            return (
              <div
                key={tier.slug}
                className={`relative rounded-xl border p-6 flex flex-col gap-4 transition-all ${
                  isHighlighted
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                } ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="outline" className="text-xs bg-background">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isHighlighted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {TIER_ICONS[tier.slug]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{tier.label}</h3>
                    <p className="text-2xl font-bold">{price}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{tier.description}</p>

                {tier.goblinCreditsPerMonth > 0 && (
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Zap className="w-4 h-4" />
                    {tier.goblinCreditsPerMonth} Goblin credits/month
                  </div>
                )}

                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full mt-2"
                  variant={isHighlighted ? "default" : "outline"}
                  disabled={
                    tier.slug === "free" ||
                    isCurrent ||
                    loadingTier === tier.slug
                  }
                  onClick={() => handleTierClick(tier.slug)}
                >
                  {isCurrent
                    ? "Current Plan"
                    : tier.slug === "free"
                    ? "Free Forever"
                    : loadingTier === tier.slug
                    ? "Redirecting..."
                    : tier.priceOneTime
                    ? "Buy Lifetime Access"
                    : "Subscribe"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Credit packs */}
        {user && (
          <div className="border border-border rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Goblin Credit Packs</h2>
                <p className="text-sm text-muted-foreground">
                  Add credits to any plan. Each Goblin ingest costs 10 credits.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(creditPacks ?? []).map((pack) => (
                <div
                  key={pack.id}
                  className="border border-border rounded-lg p-4 flex flex-col gap-3 bg-card"
                >
                  <div>
                    <p className="font-semibold">{pack.label}</p>
                    <p className="text-2xl font-bold">
                      ${(pack.price / 100).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${((pack.price / pack.credits) / 100 * 10).toFixed(2)} per ingest
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePackClick(pack.id)}
                  >
                    Buy {pack.label}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-muted-foreground">
          <div>
            <h3 className="font-semibold text-foreground mb-2">What is a Goblin credit?</h3>
            <p>
              Each Docket Goblin ingest costs 10 credits. The Goblin extracts text, classifies
              the document, drafts violation tags with source quotes, and maps actors and
              timeline events. Free accounts get 3 lifetime ingests to try it.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Can I cancel anytime?</h3>
            <p>
              Yes. Monthly subscriptions can be cancelled at any time from your billing portal.
              Lifetime tiers are permanent — no recurring charges.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Is my submission anonymous?</h3>
            <p>
              You choose your alias. Your real identity is never published. Submissions are
              reviewed before publication, and you control what gets redacted.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">What counts as verified?</h3>
            <p>
              Documents with official metadata — case numbers, agency letterhead, court stamps,
              sender/recipient headers, or file timestamps — are auto-verified. Others require
              a provenance explanation before publication.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
